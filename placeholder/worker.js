// Gli asset della pagina sono serviti prima dello script: qui arrivano solo i percorsi inesistenti.
// Lo script esiste perché un Worker di soli asset scarta i segreti a ogni deploy.
export default { fetch: () => new Response(null, { status: 404 }) };
