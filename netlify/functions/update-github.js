exports.handler = async function(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ erro: "Método não permitido." }) };
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || "caiiofelippe-ai";
  const repo = process.env.GITHUB_REPO || "iguaservicos";
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.GITHUB_FILE_PATH || "index.html";

  if (!token) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: "Variável GITHUB_TOKEN não configurada no Netlify." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: "Corpo da requisição inválido." }) };
  }

  const html = body.html;
  if (!html || typeof html !== "string" || !html.includes("<!DOCTYPE html>")) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: "HTML inválido ou vazio." }) };
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const commonHeaders = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "painel-igua-netlify-function"
  };

  try {
    let sha;
    const getResp = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers: commonHeaders });
    if (getResp.ok) {
      const atual = await getResp.json();
      sha = atual.sha;
    } else if (getResp.status !== 404) {
      const txt = await getResp.text();
      throw new Error(`Erro ao consultar arquivo no GitHub (${getResp.status}): ${txt.slice(0, 300)}`);
    }

    const content = Buffer.from(html, "utf8").toString("base64");
    const putResp = await fetch(apiBase, {
      method: "PUT",
      headers: { ...commonHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Atualiza painel operacional em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Maceio" })}`,
        content,
        branch,
        ...(sha ? { sha } : {})
      })
    });

    const resposta = await putResp.json().catch(() => ({}));
    if (!putResp.ok) {
      throw new Error(resposta.message || `Erro ao gravar no GitHub (${putResp.status}).`);
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, commit: resposta.commit && resposta.commit.sha, mensagem: "Arquivo enviado ao GitHub. O Netlify fará o deploy automaticamente." })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: e.message || "Erro inesperado ao publicar." }) };
  }
};
