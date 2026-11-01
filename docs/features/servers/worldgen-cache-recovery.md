# World generator cache recovery

A cached runtime must match the selected version, published size and SHA-1, and its own version identifier before report extraction or generation can use it.

`JAR_INTEGRITY_FAILED` rejects the current request before starting Java. When the rejected entry is the same ordinary, unshared file in the managed cache, the application retains it under a new exclusive `rejected-jars/rejected-*/rejected.jar` directory. It does not download or execute a replacement within that rejected request. Retry the action explicitly to acquire fresh bytes and verify them normally. Retained rejected files are never executed or automatically deleted.

`UNSAFE_JAR_PATH` leaves linked, shared, non-file or changed entries untouched. `JAR_QUARANTINE_FAILED` means the application could not retain the rejected entry safely; the request remains unsuccessful. Neither condition grants permission to replace an uncertain path. Metadata lookup or validation failures leave existing cache bytes untouched.

Retry downloads use an isolated acquisition directory and exclusive final placement. A file created by another writer during acquisition is preserved and the request fails. Native file-handle protection against a concurrent privileged writer is not claimed.
