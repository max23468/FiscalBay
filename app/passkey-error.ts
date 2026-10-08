export type PasskeyFailure =
  | "cancelled"
  | "timeout"
  | "unsupported"
  | "incomplete"
  | "duplicate"
  | "technical";

/** NotAllowedError non distingue un rifiuto dall'attesa scaduta: non inventare una causa. */
export function passkeyFailure(error: unknown): PasskeyFailure {
  const value = error as { code?: string; name?: string } | null;
  const code = typeof value?.code === "string" ? value.code : value?.name;
  if (
    code === "AbortError" ||
    code === "ERROR_CEREMONY_ABORTED" ||
    code === "REGISTRATION_CANCELLED"
  )
    return "cancelled";
  if (code === "TimeoutError") return "timeout";
  if (
    code === "NotSupportedError" ||
    code === "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG" ||
    code === "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT" ||
    code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT"
  )
    return "unsupported";
  if (
    code === "NotAllowedError" ||
    code === "AUTH_CANCELLED" ||
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"
  )
    return "incomplete";
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "duplicate";
  return "technical";
}
