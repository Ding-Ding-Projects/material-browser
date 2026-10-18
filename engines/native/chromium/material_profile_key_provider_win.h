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
#include "base/rand_util.h"
#include "chrome/browser/profile_key_channel_win.h"
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
    CHECK_EQ(command->GetSwitchValueASCII("material-profile-key-mode"), "managed-v2");
    const auto pipe_name = command->GetSwitchValueNative("material-profile-key-pipe");
    uint32_t expected_host = 0;
    uint64_t expected_host_created = 0;
    CHECK(base::StringToUint(command->GetSwitchValueASCII("material-host-pid"),
                            &expected_host));
    CHECK(base::StringToUint64(
        command->GetSwitchValueASCII("material-host-created"),
        &expected_host_created));
    const auto profile_id = command->GetSwitchValueASCII("material-profile-id");
    const auto profile_path = command->GetSwitchValueNative("user-data-dir");
    std::array<uint8_t, 32> nonce{};
    base::RandBytes(nonce);
    std::array<uint8_t, 32> key{};
    const bool received = key_channel::Receive(
        pipe_name, expected_host, expected_host_created, profile_id,
        profile_path, nonce, key);
    if (!received) {
      ::SecureZeroMemory(key.data(), key.size());
      CHECK(received);
    }
    key_.emplace(base::span(key), os_crypt_async::mojom::Algorithm::kAES256GCM);
    ::SecureZeroMemory(key.data(), key.size());
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
