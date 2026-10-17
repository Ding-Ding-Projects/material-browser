// Copyright 2026 Material Browser Authors.
// New application-owned profile support. No platform credential import path.
#ifndef CHROME_BROWSER_MATERIAL_PROFILE_KEY_PROVIDER_WIN_H_
#define CHROME_BROWSER_MATERIAL_PROFILE_KEY_PROVIDER_WIN_H_

#include <windows.h>

#include <algorithm>
#include <array>
#include <optional>
#include <utility>

#include "base/check.h"
#include "base/command_line.h"
#include "base/containers/span.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/win/scoped_handle.h"
#include "components/os_crypt/async/browser/key_provider.h"
#include "components/os_crypt/async/common/algorithm.mojom.h"

namespace material_browser {

// The native host owns the pipe. It releases the key only after validating the
// connecting process's private job, executable, creation time and profile path.
// The pipe name and host PID are routing data, never key material.
class ProfileKeyProvider final : public os_crypt_async::KeyProvider {
 public:
  ProfileKeyProvider() {
    const auto* command = base::CommandLine::ForCurrentProcess();
    const auto pipe_name = command->GetSwitchValueNative("material-profile-key-pipe");
    uint32_t expected_host = 0;
    CHECK(base::StringToUint(command->GetSwitchValueASCII("material-host-pid"),
                             &expected_host));
    CHECK_NE(expected_host, 0u);
    CHECK(command->HasSwitch("user-data-dir"));
    CHECK(base::StartsWith(pipe_name, L"\\\\.\\pipe\\material-browser-key-"));
    CHECK_LT(pipe_name.size(), 256u);
    CHECK(::WaitNamedPipeW(pipe_name.c_str(), 30000));
    base::win::ScopedHandle pipe(::CreateFileW(
        pipe_name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
        OPEN_EXISTING, SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION, nullptr));
    CHECK(pipe.is_valid());
    ULONG server_pid = 0;
    CHECK(::GetNamedPipeServerProcessId(pipe.get(), &server_pid));
    CHECK_EQ(server_pid, expected_host);

    std::array<uint8_t, 40> frame{};
    DWORD received = 0;
    constexpr std::array<uint8_t, 8> kMagic = {'M','B','K','E','Y',0,0,1};
    const bool valid_frame =
        ::ReadFile(pipe.get(), frame.data(), static_cast<DWORD>(frame.size()),
                   &received, nullptr) && received == frame.size() &&
        std::equal(kMagic.begin(), kMagic.end(), frame.begin());
    if (!valid_frame) {
      ::SecureZeroMemory(frame.data(), frame.size());
      CHECK(valid_frame);
    }
    key_.emplace(base::span(frame).subspan<8>(),
                 os_crypt_async::mojom::Algorithm::kAES256GCM);
    ::SecureZeroMemory(frame.data(), frame.size());
    const uint8_t acknowledgment = 1;
    DWORD sent = 0;
    CHECK(::WriteFile(pipe.get(), &acknowledgment, 1, &sent, nullptr));
    CHECK_EQ(sent, 1u);
  }

  void GetKey(KeyCallback callback) override {
    CHECK(key_.has_value());
    auto key = std::move(*key_);
    key_.reset();
    std::move(callback).Run("mb1", std::move(key));
  }

  bool UseForEncryption() override { return true; }

 private:
  std::optional<os_crypt_async::Encryptor::Key> key_;
};
}  // namespace material_browser
#endif  // CHROME_BROWSER_MATERIAL_PROFILE_KEY_PROVIDER_WIN_H_
