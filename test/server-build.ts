// L'entrypoint del Worker importa la build React Router, che esiste solo nella build
// dell'app: i test del Worker sostituiscono il request handler, quindi basta un modulo vuoto.
export {};
