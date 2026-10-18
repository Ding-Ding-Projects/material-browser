// Copyright 2026 Material Browser Authors.
// Bounded local transport only. Request metadata is not authorization.
#ifndef MATERIAL_BROWSER_PROFILE_KEY_CHANNEL_WIN_H_
#define MATERIAL_BROWSER_PROFILE_KEY_CHANNEL_WIN_H_

#include <windows.h>
#include <algorithm>
#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace material_browser::key_channel {
inline constexpr std::array<uint8_t, 8> kRequestMagic = {'M','B','K','R','E','Q',0,2};
inline constexpr std::array<uint8_t, 8> kReplyMagic = {'M','B','K','R','E','P',0,2};
inline constexpr DWORD kMaximumTimeoutMs = 30000;
inline constexpr size_t kReplySize = 72;

inline uint64_t CreationTime(HANDLE process) {
  FILETIME created{}, exited{}, kernel{}, user{};
  if (!GetProcessTimes(process, &created, &exited, &kernel, &user)) return 0;
  return (uint64_t{created.dwHighDateTime} << 32) | created.dwLowDateTime;
}

inline bool ValidProfileId(const std::string& id) {
  if (id.size() != 36) return false;
  for (size_t i = 0; i < id.size(); ++i) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (id[i] != '-') return false;
    } else if (!((id[i] >= '0' && id[i] <= '9') ||
                 (id[i] >= 'a' && id[i] <= 'f'))) return false;
  }
  return true;
}

inline bool ValidProfilePath(const std::wstring& path) {
  // Only an explicit normalized local drive path is admitted. The broker must
  // resolve its final filesystem identity and compare its own managed record.
  if (path.size() < 4 || path.size() > 1024 || path[1] != L':' ||
      path[2] != L'\\' || path.find(L'/') != std::wstring::npos ||
      path.find(L'\0') != std::wstring::npos) return false;
  if (!((path[0] >= L'A' && path[0] <= L'Z') ||
        (path[0] >= L'a' && path[0] <= L'z'))) return false;
  const std::wstring segments = L"\\" + path.substr(3) + L"\\";
  return segments.find(L"\\..\\") == std::wstring::npos &&
         segments.find(L"\\.\\") == std::wstring::npos &&
         segments.find(L"\\\\") == std::wstring::npos &&
         path.find(L':', 2) == std::wstring::npos;
}

inline void AppendInteger(std::vector<uint8_t>& out, uint64_t value, size_t bytes) {
  for (size_t i = 0; i < bytes; ++i) out.push_back(uint8_t(value >> (i * 8)));
}

inline std::vector<uint8_t> Request(const std::string& profile_id,
                                    const std::wstring& profile_path,
                                    const std::array<uint8_t, 32>& nonce) {
  if (!ValidProfileId(profile_id) || !ValidProfilePath(profile_path)) return {};
  const uint64_t created = CreationTime(GetCurrentProcess());
  if (!created) return {};
  std::vector<uint8_t> request(kRequestMagic.begin(), kRequestMagic.end());
  request.insert(request.end(), nonce.begin(), nonce.end());
  AppendInteger(request, GetCurrentProcessId(), 4);
  AppendInteger(request, created, 8);
  AppendInteger(request, profile_path.size(), 2);
  request.insert(request.end(), profile_id.begin(), profile_id.end());
  for (wchar_t c : profile_path) AppendInteger(request, uint16_t(c), 2);
  return request;
}

inline bool DecodeReply(const std::vector<uint8_t>& reply,
                        const std::array<uint8_t, 32>& nonce,
                        std::array<uint8_t, 32>& key) {
  SecureZeroMemory(key.data(), key.size());
  if (reply.size() != kReplySize ||
      !std::equal(kReplyMagic.begin(), kReplyMagic.end(), reply.begin()) ||
      !std::equal(nonce.begin(), nonce.end(), reply.begin() + 8)) return false;
  std::copy_n(reply.begin() + 40, key.size(), key.begin());
  return true;
}

inline bool Receive(const std::wstring& pipe_name, DWORD expected_host,
                    uint64_t expected_host_created,
                    const std::string& profile_id,
                    const std::wstring& profile_path,
                    const std::array<uint8_t, 32>& nonce,
                    std::array<uint8_t, 32>& key,
                    DWORD timeout_ms = kMaximumTimeoutMs) {
  SecureZeroMemory(key.data(), key.size());
  constexpr wchar_t prefix[] = L"\\\\.\\pipe\\material-browser-key-";
  if (pipe_name.rfind(prefix, 0) != 0 || pipe_name.size() < std::size(prefix) ||
      pipe_name.size() >= 256 ||
      !expected_host || !expected_host_created || !timeout_ms ||
      timeout_ms > kMaximumTimeoutMs) return false;
  for (wchar_t c : pipe_name.substr(std::size(prefix) - 1)) {
    if (!((c >= L'a' && c <= L'z') || (c >= L'0' && c <= L'9') || c == L'-'))
      return false;
  }
  auto request = Request(profile_id, profile_path, nonce);
  if (request.empty()) return false;
  const ULONGLONG deadline = GetTickCount64() + timeout_ms;
  HANDLE pipe = INVALID_HANDLE_VALUE;
  while (GetTickCount64() < deadline) {
    pipe = CreateFileW(pipe_name.c_str(), GENERIC_READ | GENERIC_WRITE, 0,
                       nullptr, OPEN_EXISTING,
                       SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION, nullptr);
    if (pipe != INVALID_HANDLE_VALUE) break;
    const DWORD error = GetLastError();
    if (error != ERROR_PIPE_BUSY && error != ERROR_FILE_NOT_FOUND) return false;
    Sleep(5);
  }
  if (pipe == INVALID_HANDLE_VALUE) return false;
  struct ClosePipe { HANDLE handle; ~ClosePipe() { CloseHandle(handle); } } close{pipe};
  ULONG server_pid = 0;
  if (!GetNamedPipeServerProcessId(pipe, &server_pid) || server_pid != expected_host)
    return false;
  HANDLE host = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, server_pid);
  if (!host) return false;
  const bool same_host = CreationTime(host) == expected_host_created;
  CloseHandle(host);
  if (!same_host) return false;
  // Explicit nonblocking message mode makes every ReadFile/WriteFile return
  // immediately. Byte pipes are rejected. No pending OVERLAPPED buffer survives
  // a timeout, and all retry loops share one deadline.
  DWORD mode = PIPE_READMODE_MESSAGE | PIPE_NOWAIT;
  if (!SetNamedPipeHandleState(pipe, &mode, nullptr, nullptr)) return false;
  DWORD written = 0;
  if (!WriteFile(pipe, request.data(), DWORD(request.size()), &written, nullptr) ||
      written != request.size()) return false;
  std::vector<uint8_t> reply(kReplySize);
  bool valid = false;
  while (GetTickCount64() < deadline) {
    DWORD read = 0;
    if (ReadFile(pipe, reply.data(), DWORD(reply.size()), &read, nullptr)) {
      reply.resize(read);
      valid = DecodeReply(reply, nonce, key);
      break;
    }
    if (GetLastError() != ERROR_NO_DATA) break;
    Sleep(5);
  }
  SecureZeroMemory(reply.data(), reply.size());
  if (!valid) SecureZeroMemory(key.data(), key.size());
  return valid;
}
}  // namespace material_browser::key_channel
#endif
