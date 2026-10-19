// Copyright 2026 Material Browser Authors.
// Synthetic transport fixtures only. No installed browser or profile is read.
#include "profile_key_channel_win.h"
#include <sddl.h>
#include <atomic>
#include <cstdio>
#include <thread>

using namespace material_browser::key_channel;
namespace {
constexpr char kProfile[] = "01234567-89ab-cdef-0123-456789abcdef";
constexpr wchar_t kPath[] = L"C:\\SyntheticOwnedProfile";
int failures = 0;
void Check(bool condition, const char* name) {
  if (!condition) { ++failures; std::printf("FAIL: %s\n", name); }
}
std::wstring OwnerAcl() {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) return {};
  DWORD bytes = 0;
  GetTokenInformation(token, TokenUser, nullptr, 0, &bytes);
  std::vector<uint8_t> data(bytes);
  const bool ok = GetTokenInformation(token, TokenUser, data.data(), bytes, &bytes);
  CloseHandle(token);
  if (!ok) return {};
  LPWSTR sid = nullptr;
  if (!ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(data.data())->User.Sid,
                             &sid)) return {};
  std::wstring acl = L"D:P(A;;GA;;;" + std::wstring(sid) + L")";
  LocalFree(sid);
  return acl;
}
bool Exchange(const std::wstring& name, bool wrong_profile, bool wrong_nonce,
              bool silent, uint64_t host_created, DWORD timeout = 500) {
  std::atomic<bool> ready{false};
  std::atomic<bool> server_ok{false};
  std::thread server([&] {
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    const auto acl = OwnerAcl();
    if (acl.empty() || !ConvertStringSecurityDescriptorToSecurityDescriptorW(
            acl.c_str(), SDDL_REVISION_1, &descriptor, nullptr)) {
      ready = true; return;
    }
    SECURITY_ATTRIBUTES attributes{sizeof(attributes), descriptor, FALSE};
    HANDLE pipe = CreateNamedPipeW(name.c_str(),
        PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
        PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_NOWAIT |
            PIPE_REJECT_REMOTE_CLIENTS,
        1, 4096, 4096, 0, &attributes);
    LocalFree(descriptor);
    ready = true;
    if (pipe == INVALID_HANDLE_VALUE) return;
    const auto deadline = GetTickCount64() + 2000;
    bool connected = false;
    while (GetTickCount64() < deadline) {
      if (ConnectNamedPipe(pipe, nullptr) || GetLastError() == ERROR_PIPE_CONNECTED) {
        connected = true; break;
      }
      Sleep(2);
    }
    if (connected) {
      ULONG client_pid = 0;
      GetNamedPipeClientProcessId(pipe, &client_pid);
      HANDLE client = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, client_pid);
      const bool peer = client && client_pid == GetCurrentProcessId() &&
          CreationTime(client) == CreationTime(GetCurrentProcess());
      if (client) CloseHandle(client);
      std::vector<uint8_t> request(4096);
      DWORD count = 0;
      while (GetTickCount64() < deadline) {
        if (ReadFile(pipe, request.data(), DWORD(request.size()), &count, nullptr)) break;
        if (GetLastError() != ERROR_NO_DATA) break;
        Sleep(2);
      }
      request.resize(count);
      std::array<uint8_t, 32> nonce{};
      if (request.size() >= 40) std::copy_n(request.begin() + 8, 32, nonce.begin());
      const auto expected = Request(kProfile, kPath, nonce);
      const bool bound = peer && request == expected;
      server_ok = bound;
      if (bound && !wrong_profile && !silent) {
        std::vector<uint8_t> reply(kReplyMagic.begin(), kReplyMagic.end());
        if (wrong_nonce) ++nonce[0];
        reply.insert(reply.end(), nonce.begin(), nonce.end());
        reply.insert(reply.end(), 32, 0x5a);  // Public synthetic fixture bytes.
        DWORD sent = 0;
        WriteFile(pipe, reply.data(), DWORD(reply.size()), &sent, nullptr);
        SecureZeroMemory(reply.data(), reply.size());
        Sleep(100);
      } else if (silent) Sleep(timeout + 50);
    }
    CloseHandle(pipe);
  });
  while (!ready) Sleep(1);
  std::array<uint8_t, 32> nonce{};
  nonce.fill(0x13);
  std::array<uint8_t, 32> key{};
  const auto began = GetTickCount64();
  const bool received = Receive(name, GetCurrentProcessId(), host_created,
      wrong_profile ? "11234567-89ab-cdef-0123-456789abcdef" : kProfile,
      kPath, nonce, key, timeout);
  const auto elapsed = GetTickCount64() - began;
  if (received) Check(key == std::array<uint8_t, 32>{
      0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,
      0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,
      0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,
      0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a,0x5a}, "synthetic reply bytes");
  else Check(std::all_of(key.begin(), key.end(), [](auto b) { return b == 0; }),
             "failed exchange wipes output");
  SecureZeroMemory(key.data(), key.size());
  server.join();
  Check(elapsed < timeout + 250, "bounded client exchange");
  if (!wrong_profile && host_created == CreationTime(GetCurrentProcess()))
    Check(server_ok, "OS-observed client and complete request binding");
  return received;
}
}  // namespace
int main() {
  Check(ValidProfileId(kProfile), "profile identity admitted");
  Check(!ValidProfileId("default"), "default profile alias rejected");
  Check(!ValidProfilePath(L"C:\\Synthetic\\..\\Default"), "path traversal rejected");
  Check(!ValidProfilePath(L"\\\\host\\share"), "network profile path rejected");
  Check(!ValidProfilePath(L"C:\\Profile:stream"), "alternate stream rejected");
  std::array<uint8_t, 32> nonce{}, key{};
  std::vector<uint8_t> reply(kReplyMagic.begin(), kReplyMagic.end());
  reply.insert(reply.end(), 64, 0);
  Check(DecodeReply(reply, nonce, key), "exact reply accepted");
  reply.push_back(0);
  Check(!DecodeReply(reply, nonce, key), "oversized or duplicate reply rejected");
  reply.resize(kReplySize - 1);
  Check(!DecodeReply(reply, nonce, key), "truncated reply rejected");
  reply.resize(kReplySize); reply[7] = 1;
  Check(!DecodeReply(reply, nonce, key), "old protocol rejected");
  const auto prefix = L"\\\\.\\pipe\\material-browser-key-fixture-" +
      std::to_wstring(GetCurrentProcessId()) + L"-";
  const auto created = CreationTime(GetCurrentProcess());
  Check(Exchange(prefix + L"valid", false, false, false, created), "local exchange");
  Check(!Exchange(prefix + L"scope", true, false, false, created), "wrong profile rejected");
  Check(!Exchange(prefix + L"replay", false, true, false, created), "stale challenge rejected");
  Check(!Exchange(prefix + L"timeout", false, false, true, created, 100), "silent broker bounded");
  Check(!Exchange(prefix + L"identity", false, false, false, created + 1), "wrong host creation rejected");
  std::printf("Synthetic protected-channel fixture: %s\n", failures ? "FAIL" : "PASS");
  return failures ? 1 : 0;
}
