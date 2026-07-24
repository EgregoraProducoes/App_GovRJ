/*
  ============================================================================
  APP.JS - LÓGICA JAVASCRIPT DO FRONTEND GOVRJ
  ============================================================================

  O QUE É ESTE ARQUIVO:
  Este é o "cérebro" do app no lado do usuário (frontend).
  Ele cuida de:
  1. Capturar cliques e digitações do usuário
  2. Validar formulários antes de enviar
  3. Comunicar com o Google Apps Script (backend) via HTTPS
  4. Gerenciar a sessão do usuário (token JWT no localStorage)
  5. Controlar qual tela está visível (login, recuperar, trocar senha, criar admin)
  6. Mostrar mensagens de sucesso/erro (toast)
  7. Salvar o email no localStorage ("lembrar-me")

  ARQUITETURA:
  - JavaScript puro (vanilla JS), sem frameworks
  - Usa a API fetch() nativa do navegador para fazer requisições HTTP
  - Usa localStorage para persistir dados no navegador do usuário
  - Usa Promises (async/await) para lidar com operações assíncronas

  IMPORTANTE:
  - Troque a URL abaixo pela URL do SEU Apps Script após publicar
  - NUNCA coloque senhas ou chaves secretas neste arquivo (é público no GitHub)
  ============================================================================
*/


// =============================================================================
// SEÇÃO 1: CONFIGURAÇÕES GLOBAIS
// =============================================================================
// Variáveis que precisam ser acessíveis em todo o arquivo.
// Usamos const (constante) para valores que não mudam.

/**
 * URL do endpoint do Google Apps Script.
 * 
 * POR QUE EXISTE: Todas as requisições do app vão para esta URL.
 * O Apps Script recebe, processa e responde.
 * 
 * ⚠️ IMPORTANTE: Troque esta URL pela URL do SEU Apps Script!
 * A URL fica disponível após publicar o Apps Script como Web App.
 * Formato: https://script.google.com/macros/s/SEU_CODIGO_AQUI/exec
 */
const API_URL = "https://script.google.com/macros/s/SEU_CODIGO_AQUI/exec";

/**
 * Chave usada no localStorage para guardar o token JWT.
 * 
 * POR QUE EXISTE: Precisamos de uma chave fixa para salvar e ler o token.
 * Se mudarmos esta chave, perdemos acesso aos tokens salvos.
 */
const STORAGE_TOKEN_KEY = "govrj_token";

/**
 * Chave usada no localStorage para guardar o email ("lembrar-me").
 */
const STORAGE_EMAIL_KEY = "govrj_email_lembrado";


// =============================================================================
// SEÇÃO 2: FUNÇÕES UTILITÁRIAS (HELPERS)
// =============================================================================
// Funções pequenas e reutilizáveis que fazem tarefas específicas.
// São como "ferramentas" que usamos em vários lugares do código.

/**
 * mostrarTela(idTela)
 * -------------------
 * O QUE FAZ: Mostra uma tela específica e esconde todas as outras.
 * 
 * POR QUE EXISTE: Temos 4 telas (login, recuperar, trocar senha, criar admin)
 * mas só uma pode estar visível por vez. Esta função controla isso.
 * 
 * COMO FUNCIONA:
 * 1. Pega todas as divs com classe "tela"
 * 2. Remove a classe "ativa" de todas (ficam invisíveis)
 * 3. Adiciona a classe "ativa" na tela solicitada (fica visível)
 * 
 * @param {string} idTela - ID da tela a mostrar (ex: "tela-login")
 */
function mostrarTela(idTela) {
  // Pega TODAS as telas do documento (array de elementos HTML)
  var telas = document.querySelectorAll(".tela");

  // Percorre cada tela e remove a classe "ativa"
  // forEach = "para cada elemento, faça..."
  telas.forEach(function(tela) {
    tela.classList.remove("ativa");
  });

  // Pega a tela específica que queremos mostrar
  var telaAlvo = document.getElementById(idTela);

  // Se encontrou a tela, adiciona a classe "ativa" (fica visível)
  if (telaAlvo) {
    telaAlvo.classList.add("ativa");
  }
}

/**
 * mostrarToast(mensagem, tipo)
 * ----------------------------
 * O QUE FAZ: Mostra uma mensagem flutuante no topo da tela.
 * 
 * POR QUE EXISTE: Precisamos informar o usuário sobre sucessos e erros
 * sem interromper o fluxo (sem alert() chato).
 * 
 * @param {string} mensagem - Texto a mostrar
 * @param {string} tipo - "sucesso" (verde) ou "erro" (vermelho)
 */
function mostrarToast(mensagem, tipo) {
  // Pega os elementos do toast
  var toast = document.getElementById("toast");
  var toastMensagem = document.getElementById("toast-mensagem");

  // Define o texto da mensagem
  toastMensagem.textContent = mensagem;

  // Remove classes antigas de tipo (para não acumular)
  toast.classList.remove("sucesso", "erro");

  // Adiciona a classe do tipo solicitado
  toast.classList.add(tipo);  // "sucesso" ou "erro"

  // Mostra o toast (remove display:none e adiciona classe visivel)
  toast.style.display = "block";

  // Pequeno delay para a animação CSS funcionar (transição suave)
  setTimeout(function() {
    toast.classList.add("visivel");
  }, 10);

  // Esconde o toast automaticamente após 4 segundos
  setTimeout(function() {
    toast.classList.remove("visivel");

    // Aguarda a animação de saída terminar (300ms) antes de esconder completamente
    setTimeout(function() {
      toast.style.display = "none";
    }, 300);
  }, 4000);
}

/**
 * mostrarErroCampo(inputId, mensagemId, mostrar)
 * ------------------------------------------------
 * O QUE FAZ: Mostra ou esconde a mensagem de erro de um campo.
 * 
 * @param {string} inputId - ID do input (campo de texto)
 * @param {string} mensagemId - ID da mensagem de erro
 * @param {boolean} mostrar - true para mostrar erro, false para esconder
 */
function mostrarErroCampo(inputId, mensagemId, mostrar) {
  var input = document.getElementById(inputId);
  var mensagem = document.getElementById(mensagemId);

  if (mostrar) {
    // Adiciona classe "erro" no input (borda vermelha)
    input.classList.add("erro");
    // Adiciona classe "visivel" na mensagem (mostra o texto)
    mensagem.classList.add("visivel");
  } else {
    // Remove as classes (volta ao normal)
    input.classList.remove("erro");
    mensagem.classList.remove("visivel");
  }
}

/**
 * limparErros()
 * -------------
 * O QUE FAZ: Remove TODAS as mensagens de erro de todos os campos.
 * 
 * POR QUE EXISTE: Antes de validar um formulário, limpamos erros antigos
 * para não confundir o usuário.
 */
function limparErros() {
  // Pega todos os inputs com classe "erro" e remove a classe
  var inputsComErro = document.querySelectorAll(".form-input.erro");
  inputsComErro.forEach(function(input) {
    input.classList.remove("erro");
  });

  // Pega todas as mensagens de erro visíveis e esconde
  var mensagensErro = document.querySelectorAll(".error-msg.visivel");
  mensagensErro.forEach(function(msg) {
    msg.classList.remove("visivel");
  });
}

/**
 * validarEmail(email)
 * -------------------
 * O QUE FAZ: Verifica se um texto é um email válido.
 * 
 * COMO FUNCIONA: Usa uma expressão regular (regex) que verifica o padrão
 * texto@dominio.extensao
 * 
 * @param {string} email - Texto a validar
 * @returns {boolean} - true se é email válido, false se não
 */
function validarEmail(email) {
  // Expressão regular para validar email
  // ^ = início da string
  // [^\s@]+ = um ou mais caracteres que NÃO são espaço ou @
  // @ = símbolo de arroba obrigatório
  // \. = ponto literal
  // $ = fim da string
  var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * setCarregando(botaoId, carregando)
 * ----------------------------------
 * O QUE FAZ: Alterna o estado de um botão entre "normal" e "carregando".
 * 
 * POR QUE EXISTE: Quando o usuário clica em "Entrar", o app demora alguns
 * segundos para receber a resposta do servidor. Mostramos um spinner
 * para indicar que algo está acontecendo e evitar cliques duplos.
 * 
 * @param {string} botaoId - ID do botão
 * @param {boolean} carregando - true = mostra spinner, false = mostra texto normal
 */
function setCarregando(botaoId, carregando) {
  var botao = document.getElementById(botaoId);
  var texto = botao.querySelector(".btn-text");
  var loading = botao.querySelector(".btn-loading");

  if (carregando) {
    // Esconde o texto normal, mostra o spinner
    texto.style.display = "none";
    loading.style.display = "flex";
    // Desabilita o botão (impede cliques repetidos)
    botao.disabled = true;
  } else {
    // Volta ao normal
    texto.style.display = "inline";
    loading.style.display = "none";
    botao.disabled = false;
  }
}

/**
 * salvarToken(token)
 * ------------------
 * O QUE FAZ: Guarda o token JWT no localStorage do navegador.
 * 
 * POR QUE EXISTE: O token prova que o usuário está logado. Precisamos
 * guardá-lo para enviar em todas as requisições futuras.
 * 
 * @param {string} token - Token JWT recebido do backend
 */
function salvarToken(token) {
  // localStorage é um "armário" do navegador que persiste mesmo
  // se o usuário fechar e abrir o navegador de novo.
  // setItem guarda um valor com uma chave (nome).
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
}

/**
 * pegarToken()
 * ------------
 * O QUE FAZ: Lê o token JWT salvo no localStorage.
 * 
 * @returns {string|null} - O token se existir, null se não houver
 */
function pegarToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

/**
 * removerToken()
 * --------------
 * O QUE FAZ: Remove o token do localStorage (logout).
 */
function removerToken() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
}

/**
 * salvarEmailLembrado(email)
 * --------------------------
 * O QUE FAZ: Guarda o email no localStorage (checkbox "Lembrar email").
 * 
 * @param {string} email - Email a lembrar
 */
function salvarEmailLembrado(email) {
  localStorage.setItem(STORAGE_EMAIL_KEY, email);
}

/**
 * pegarEmailLembrado()
 * --------------------
 * O QUE FAZ: Lê o email salvo no localStorage.
 * 
 * @returns {string|null} - Email salvo ou null
 */
function pegarEmailLembrado() {
  return localStorage.getItem(STORAGE_EMAIL_KEY);
}

/**
 * limparEmailLembrado()
 * ---------------------
 * O QUE FAZ: Remove o email salvo (usuário desmarcou "lembrar").
 */
function limparEmailLembrado() {
  localStorage.removeItem(STORAGE_EMAIL_KEY);
}


// =============================================================================
// SEÇÃO 3: FUNÇÃO PRINCIPAL DE COMUNICAÇÃO COM O BACKEND
// =============================================================================
// Esta é a função mais importante: ela envia dados para o Apps Script
// e recebe a resposta. TODAS as ações do app usam esta função.

/**
 * chamarAPI(acao, dados)
 * ----------------------
 * O QUE FAZ: Envia uma requisição HTTP POST para o Google Apps Script.
 * 
 * POR QUE EXISTE: Centraliza TODA a comunicação com o backend em uma
 * única função. Se precisarmos mudar algo (adicionar headers, por exemplo),
// mudamos só aqui.
 * 
 * COMO FUNCIONA:
 * 1. Monta um objeto com a ação e os dados
 * 2. Converte para JSON (string)
 * 3. Envia via fetch() usando método POST
 * 4. Aguarda a resposta do servidor
 * 5. Converte a resposta de JSON para objeto JavaScript
 * 6. Retorna o objeto da resposta
 * 
 * @param {string} acao - Nome da ação (ex: "login", "trocar_senha")
 * @param {Object} dados - Objeto com os dados da requisição
 * @returns {Promise<Object>} - Promise que resolve com a resposta do servidor
 */
async function chamarAPI(acao, dados) {
  // Monta o corpo da requisição
  // Sempre inclui a ação e um timestamp do cliente (para auditoria)
  var body = {
    action: acao,                          // Ação que o backend deve executar
    timestampCliente: new Date().toISOString(),  // Hora do cliente (quando o usuário agiu)
    ...dados                              // Espalha os dados adicionais recebidos
  };

  try {
    // fetch() é a API nativa do navegador para fazer requisições HTTP.
    // await faz a função "esperar" a resposta antes de continuar.
    var resposta = await fetch(API_URL, {
      method: "POST",                      // Método HTTP POST (envia dados no corpo)
      headers: {
        "Content-Type": "application/json" // Diz que estamos enviando JSON
      },
      body: JSON.stringify(body)           // Converte o objeto para string JSON
    });

    // Verifica se a resposta HTTP foi bem-sucedida (status 200-299)
    if (!resposta.ok) {
      throw new Error("Erro na conexão com o servidor (HTTP " + resposta.status + ")");
    }

    // Converte a resposta de JSON (texto) para objeto JavaScript
    var resultado = await resposta.json();

    return resultado;  // Retorna o objeto { success, data, message, error }

  } catch (erro) {
    // Se algo deu errado (sem internet, servidor offline, etc)
    console.error("Erro na API:", erro);  // Mostra no console do desenvolvedor

    // Retorna um objeto de erro padronizado
    return {
      success: false,
      data: null,
      message: "Erro de conexão. Verifique sua internet e tente novamente.",
      error: "NETWORK_ERROR"
    };
  }
}


// =============================================================================
// SEÇÃO 4: HANDLERS DOS FORMULÁRIOS (AÇÕES DO USUÁRIO)
// =============================================================================
// Cada função abaixo é chamada quando o usuário envia um formulário.
// Elas validam os dados, chamam a API e tratam a resposta.

/**
 * handleLogin(event)
 * ------------------
 * O QUE FAZ: Processa o envio do formulário de login.
 * 
 * FLUXO:
 * 1. Previne o comportamento padrão do formulário (não recarrega a página)
 * 2. Limpa erros anteriores
 * 3. Lê os valores dos campos (email e senha)
 * 4. Valida os campos
 * 5. Se válido, envia para o backend
 * 6. Se sucesso, verifica se é primeiro acesso
 * 7. Se primeiro acesso, mostra tela de troca de senha
 * 8. Se não, salva o token e vai para o dashboard (futuro)
 * 
 * @param {Event} event - Objeto do evento de submit do formulário
 */
async function handleLogin(event) {
  // preventDefault() impede que o navegador recarregue a página ao enviar o form.
  // É ESSENCIAL em SPAs (Single Page Applications) como a nossa.
  event.preventDefault();

  // Limpa erros antigos para não confundir o usuário
  limparErros();

  // Lê os valores dos campos
  var emailInput = document.getElementById("login-email");
  var senhaInput = document.getElementById("login-senha");
  var lembrarCheckbox = document.getElementById("lembrar-email");

  var email = emailInput.value.trim();    // trim() remove espaços no início/fim
  var senha = senhaInput.value;

  // ---------------------------------------------------------------------------
  // VALIDAÇÃO DOS CAMPOS
  // ---------------------------------------------------------------------------
  var temErro = false;

  // Valida email: não pode estar vazio e deve ser formato válido
  if (!email) {
    mostrarErroCampo("login-email", "erro-email", true);
    temErro = true;
  } else if (!validarEmail(email)) {
    mostrarErroCampo("login-email", "erro-email", true);
    document.getElementById("erro-email").textContent = "Formato de email inválido";
    temErro = true;
  }

  // Valida senha: não pode estar vazia
  if (!senha) {
    mostrarErroCampo("login-senha", "erro-senha", true);
    temErro = true;
  }

  // Se encontrou algum erro, para aqui (não envia para o servidor)
  if (temErro) {
    // Adiciona efeito de "tremida" no cartão para chamar atenção
    document.querySelector("#tela-login .card").classList.add("shake");
    setTimeout(function() {
      document.querySelector("#tela-login .card").classList.remove("shake");
    }, 500);
    return;
  }

  // ---------------------------------------------------------------------------
  // ENVIO PARA O BACKEND
  // ---------------------------------------------------------------------------
  // Mostra o estado de carregamento no botão
  setCarregando("btn-entrar", true);

  // Chama a API com a ação "login"
  var resultado = await chamarAPI("login", {
    email: email,
    senha: senha
  });

  // Esconde o estado de carregamento
  setCarregando("btn-entrar", false);

  // ---------------------------------------------------------------------------
  // TRATAMENTO DA RESPOSTA
  // ---------------------------------------------------------------------------
  if (resultado.success) {
    // LOGIN BEM-SUCEDIDO!

    // Salva o token JWT no localStorage
    salvarToken(resultado.data.token);

    // Se marcou "Lembrar email", salva o email
    if (lembrarCheckbox.checked) {
      salvarEmailLembrado(email);
    } else {
      limparEmailLembrado();
    }

    // Verifica se é primeiro acesso (senha provisória)
    if (resultado.data.primeiroAcesso) {
      // É primeiro acesso! Mostra tela de troca de senha.
      mostrarToast("Login realizado! Crie sua senha pessoal.", "sucesso");

      // Preenche o campo oculto com o token (necessário para a troca de senha)
      document.getElementById("trocar-token").value = resultado.data.token;

      // Mostra a tela de troca de senha
      mostrarTela("tela-trocar-senha");
    } else {
      // Não é primeiro acesso. Usuário está pronto para usar o app.
      mostrarToast("Bem-vindo, " + resultado.data.nome + "!", "sucesso");

      // AQUI ENTRARIA O REDIRECIONAMENTO PARA O DASHBOARD
      // Na Fase 1, apenas mostramos uma mensagem de sucesso.
      // Na Fase 2, redirecionaremos para a tela principal do app.
      console.log("Usuário logado:", resultado.data);
      console.log("Token:", resultado.data.token);
      console.log("Nível:", resultado.data.nivel);

      // Placeholder: mostra uma mensagem indicando o próximo passo
      setTimeout(function() {
        mostrarToast("Dashboard será implementado na Fase 2", "sucesso");
      }, 2000);
    }

  } else {
    // LOGIN FALHOU!
    // Mostra a mensagem de erro retornada pelo backend
    mostrarToast(resultado.message, "erro");

    // Se o erro for de credenciais inválidas, destaca os campos
    if (resultado.error === "INVALID_CREDENTIALS") {
      mostrarErroCampo("login-email", "erro-email", true);
      mostrarErroCampo("login-senha", "erro-senha", true);
      document.getElementById("erro-email").textContent = "Email ou senha incorretos";
      document.getElementById("erro-senha").textContent = "Email ou senha incorretos";
    }
  }
}

/**
 * handleRecuperarSenha(event)
 * ---------------------------
 * O QUE FAZ: Processa o envio do formulário de recuperação de senha.
 * 
 * FLUXO:
 * 1. Valida o email
 * 2. Envia para o backend (ação "recuperar_senha")
 * 3. Mostra mensagem de sucesso (mesmo se o email não existir, por segurança)
 * 4. Volta para a tela de login
 * 
 * @param {Event} event - Evento de submit
 */
async function handleRecuperarSenha(event) {
  event.preventDefault();
  limparErros();

  var emailInput = document.getElementById("recuperar-email");
  var email = emailInput.value.trim();

  // Validação
  if (!email || !validarEmail(email)) {
    mostrarErroCampo("recuperar-email", "erro-recuperar-email", true);
    return;
  }

  // Carregando
  setCarregando("btn-recuperar", true);

  // Chama a API
  var resultado = await chamarAPI("recuperar_senha", {
    email: email
  });

  setCarregando("btn-recuperar", false);

  // Sempre mostra mensagem de sucesso (não revelamos se o email existe)
  mostrarToast(resultado.message, "sucesso");

  // Volta para a tela de login após 2 segundos
  setTimeout(function() {
    mostrarTela("tela-login");
  }, 2000);
}

/**
 * handleTrocarSenha(event)
 * ------------------------
 * O QUE FAZ: Processa o envio do formulário de troca de senha.
 * 
 * FLUXO:
 * 1. Valida os 3 campos (senha atual, nova senha, confirmar)
 * 2. Verifica se nova senha tem no mínimo 6 caracteres
 * 3. Verifica se nova senha e confirmação são iguais
 * 4. Envia para o backend com o token JWT
 * 5. Se sucesso, mostra mensagem e volta para login
 * 
 * @param {Event} event - Evento de submit
 */
async function handleTrocarSenha(event) {
  event.preventDefault();
  limparErros();

  // Lê os valores
  var token = document.getElementById("trocar-token").value;
  var senhaAtual = document.getElementById("trocar-senha-atual").value;
  var novaSenha = document.getElementById("trocar-nova-senha").value;
  var confirmarSenha = document.getElementById("trocar-confirmar-senha").value;

  var temErro = false;

  // Valida senha atual
  if (!senhaAtual) {
    mostrarErroCampo("trocar-senha-atual", "erro-senha-atual", true);
    temErro = true;
  }

  // Valida nova senha (mínimo 6 caracteres)
  if (!novaSenha || novaSenha.length < 6) {
    mostrarErroCampo("trocar-nova-senha", "erro-nova-senha", true);
    temErro = true;
  }

  // Valida confirmação (deve ser igual à nova senha)
  if (novaSenha !== confirmarSenha) {
    mostrarErroCampo("trocar-confirmar-senha", "erro-confirmar-senha", true);
    temErro = true;
  }

  if (temErro) {
    document.querySelector("#tela-trocar-senha .card").classList.add("shake");
    setTimeout(function() {
      document.querySelector("#tela-trocar-senha .card").classList.remove("shake");
    }, 500);
    return;
  }

  // Carregando
  setCarregando("btn-trocar-senha", true);

  // Chama a API
  var resultado = await chamarAPI("trocar_senha", {
    token: token,
    senhaAtual: senhaAtual,
    novaSenha: novaSenha
  });

  setCarregando("btn-trocar-senha", false);

  if (resultado.success) {
    mostrarToast("Senha alterada com sucesso! Faça login novamente.", "sucesso");

    // Remove o token antigo (a senha mudou, precisa logar de novo)
    removerToken();

    // Limpa os campos
    document.getElementById("form-trocar-senha").reset();

    // Volta para a tela de login
    setTimeout(function() {
      mostrarTela("tela-login");
    }, 2000);
  } else {
    mostrarToast(resultado.message, "erro");

    // Se erro for senha atual incorreta, destaca o campo
    if (resultado.error === "WRONG_CURRENT_PASSWORD") {
      mostrarErroCampo("trocar-senha-atual", "erro-senha-atual", true);
    }
  }
}

/**
 * handleCriarAdmin(event)
 * -----------------------
 * O QUE FAZ: Processa o envio do formulário de criação do primeiro admin.
 * 
 * FLUXO:
 * 1. Valida todos os campos
 * 2. Verifica se senha tem no mínimo 8 caracteres
 * 3. Verifica se senhas coincidem
 * 4. Envia para o backend (ação "criar_admin")
 * 5. Se sucesso, mostra mensagem e vai para login
 * 
 * @param {Event} event - Evento de submit
 */
async function handleCriarAdmin(event) {
  event.preventDefault();
  limparErros();

  // Lê os valores
  var nome = document.getElementById("admin-nome").value.trim();
  var email = document.getElementById("admin-email").value.trim();
  var senha = document.getElementById("admin-senha").value;
  var confirmar = document.getElementById("admin-confirmar").value;

  var temErro = false;

  // Valida nome
  if (!nome) {
    mostrarErroCampo("admin-nome", "erro-admin-nome", true);
    temErro = true;
  }

  // Valida email
  if (!email || !validarEmail(email)) {
    mostrarErroCampo("admin-email", "erro-admin-email", true);
    temErro = true;
  }

  // Valida senha (mínimo 8 para admin)
  if (!senha || senha.length < 8) {
    mostrarErroCampo("admin-senha", "erro-admin-senha", true);
    temErro = true;
  }

  // Valida confirmação
  if (senha !== confirmar) {
    mostrarErroCampo("admin-confirmar", "erro-admin-confirmar", true);
    temErro = true;
  }

  if (temErro) {
    document.querySelector("#tela-criar-admin .card").classList.add("shake");
    setTimeout(function() {
      document.querySelector("#tela-criar-admin .card").classList.remove("shake");
    }, 500);
    return;
  }

  // Carregando
  setCarregando("btn-criar-admin", true);

  // Chama a API
  var resultado = await chamarAPI("criar_admin", {
    nome: nome,
    email: email,
    senha: senha
  });

  setCarregando("btn-criar-admin", false);

  if (resultado.success) {
    mostrarToast("Administrador criado! Faça login para começar.", "sucesso");

    // Limpa o formulário
    document.getElementById("form-criar-admin").reset();

    // Vai para a tela de login
    setTimeout(function() {
      mostrarTela("tela-login");
    }, 2000);
  } else {
    mostrarToast(resultado.message, "erro");
  }
}


// =============================================================================
// SEÇÃO 5: VERIFICAÇÕES INICIAIS (QUANDO A PÁGINA CARREGA)
// =============================================================================
// Estas funções rodam automaticamente quando o usuário abre o app.
// Verificamos se já existe token, se precisa criar admin, etc.

/**
 * verificarSessaoExistente()
 * --------------------------
 * O QUE FAZ: Verifica se o usuário já tem um token JWT salvo.
 * 
 * POR QUE EXISTE: Se o usuário fechou o navegador e abriu de novo,
 * não queremos forçá-lo a fazer login toda vez. Verificamos se o
 * token ainda é válido.
 * 
 * FLUXO:
 * 1. Lê o token do localStorage
 * 2. Se não existe, mostra tela de login
 * 3. Se existe, envia para o backend verificar se ainda é válido
 * 4. Se válido, mostra mensagem de boas-vindas (futuro: vai para dashboard)
 * 5. Se inválido, remove o token e mostra login
 */
async function verificarSessaoExistente() {
  var token = pegarToken();

  // Se não há token salvo, não faz nada (fica na tela de login)
  if (!token) {
    return;
  }

  // Há um token! Vamos verificar se ainda é válido.
  var resultado = await chamarAPI("verificar_token", {
    token: token
  });

  if (resultado.success) {
    // Token ainda é válido! O usuário está logado.
    mostrarToast("Sessão restaurada. Bem-vindo de volta!", "sucesso");

    // AQUI ENTRARIA O REDIRECIONAMENTO PARA O DASHBOARD (Fase 2)
    console.log("Sessão ativa:", resultado.data);
  } else {
    // Token expirou ou é inválido. Remove e pede login de novo.
    removerToken();
    mostrarToast("Sua sessão expirou. Faça login novamente.", "erro");
  }
}

/**
 * verificarSePrecisaCriarAdmin()
 * ------------------------------
 * O QUE FAZ: Verifica se já existe algum usuário no sistema.
 * 
 * POR QUE EXISTE: Na primeira instalação, não existe nenhum admin.
 * Precisamos mostrar a tela de configuração inicial.
 * 
 * COMO FUNCIONA: Tenta fazer login com credenciais vazias (vai falhar),
 * mas se o erro for "ADMIN_EXISTS" ou similar, sabemos que já existe admin.
 * 
 * Na prática, vamos usar uma abordagem mais simples: tentamos criar um admin
 * "fantasma" e se o backend disser que já existe, mostramos login.
 * 
 * ALTERNATIVA SIMPLES: Na Fase 1, vamos apenas mostrar a tela de criar admin
 * se o usuário clicar em um link especial, ou verificamos via uma ação específica.
 * 
 * Para simplificar, vamos deixar a tela de criar admin acessível via link
 * e na Fase 2 implementamos a verificação automática.
 */
async function verificarSePrecisaCriarAdmin() {
  // Na Fase 1, vamos apenas verificar se há token.
  // Se não há token, mostramos login normalmente.
  // A tela de criar admin será acessível manualmente (para setup inicial).

  var token = pegarToken();
  if (token) {
    await verificarSessaoExistente();
  }
}

/**
 * preencherEmailLembrado()
 * ------------------------
 * O QUE FAZ: Se o usuário marcou "Lembrar email" anteriormente,
 * preenche o campo de email automaticamente e marca o checkbox.
 */
function preencherEmailLembrado() {
  var emailSalvo = pegarEmailLembrado();
  if (emailSalvo) {
    document.getElementById("login-email").value = emailSalvo;
    document.getElementById("lembrar-email").checked = true;
  }
}


// =============================================================================
// SEÇÃO 6: EVENT LISTENERS (QUANDO O USUÁRIO INTERAGE)
// =============================================================================
// Aqui conectamos as ações do usuário (cliques, envios) às funções.
// O DOMContentLoaded garante que o HTML já foi carregado antes de
// tentarmos encontrar os elementos.

document.addEventListener("DOMContentLoaded", function() {
  // DOMContentLoaded = "o HTML foi completamente carregado e parseado"
  // É seguro buscar elementos do DOM agora.

  // ==========================================================================
  // LISTENER 1: Formulário de Login
  // ==========================================================================
  // Quando o usuário enviar o formulário de login (clicar em "Entrar"
  // ou pressionar Enter), chama a função handleLogin.
  var formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", handleLogin);
  }

  // ==========================================================================
  // LISTENER 2: Link "Esqueci minha senha"
  // ==========================================================================
  // Quando clicar no link, mostra a tela de recuperação.
  var linkRecuperar = document.getElementById("link-recuperar");
  if (linkRecuperar) {
    linkRecuperar.addEventListener("click", function(event) {
      event.preventDefault();  // Impede o link de navegar para "#"
      mostrarTela("tela-recuperar");
    });
  }

  // ==========================================================================
  // LISTENER 3: Formulário de Recuperação de Senha
  // ==========================================================================
  var formRecuperar = document.getElementById("form-recuperar");
  if (formRecuperar) {
    formRecuperar.addEventListener("submit", handleRecuperarSenha);
  }

  // ==========================================================================
  // LISTENER 4: Link "Voltar para o login" (na tela de recuperação)
  // ==========================================================================
  var linkVoltar = document.getElementById("link-voltar-login");
  if (linkVoltar) {
    linkVoltar.addEventListener("click", function(event) {
      event.preventDefault();
      mostrarTela("tela-login");
    });
  }

  // ==========================================================================
  // LISTENER 5: Formulário de Troca de Senha
  // ==========================================================================
  var formTrocar = document.getElementById("form-trocar-senha");
  if (formTrocar) {
    formTrocar.addEventListener("submit", handleTrocarSenha);
  }

  // ==========================================================================
  // LISTENER 6: Formulário de Criar Administrador
  // ==========================================================================
  var formCriarAdmin = document.getElementById("form-criar-admin");
  if (formCriarAdmin) {
    formCriarAdmin.addEventListener("submit", handleCriarAdmin);
  }

  // ==========================================================================
  // INICIALIZAÇÃO: Preenche email lembrado e verifica sessão
  // ==========================================================================
  preencherEmailLembrado();
  verificarSePrecisaCriarAdmin();
});


// =============================================================================
// SEÇÃO 7: FUNÇÕES DE NAVEGAÇÃO MANUAL (PARA DESENVOLVIMENTO)
// =============================================================================
// Estas funções são úteis durante o desenvolvimento/teste.
// Você pode chamá-las no console do navegador (F12 > Console).

/**
 * devMostrarCriarAdmin()
 * ----------------------
 * O QUE FAZ: Mostra a tela de criar admin manualmente.
 * 
 * COMO USAR: Abra o console do navegador (F12) e digite:
 * devMostrarCriarAdmin()
 * 
 * Útil para testar a criação do primeiro administrador.
 */
function devMostrarCriarAdmin() {
  mostrarTela("tela-criar-admin");
}

/**
 * devMostrarTrocarSenha()
 * -----------------------
 * O QUE FAZ: Mostra a tela de troca de senha manualmente.
 * 
 * COMO USAR: devMostrarTrocarSenha()
 */
function devMostrarTrocarSenha() {
  mostrarTela("tela-trocar-senha");
}

/**
 * devLimparStorage()
 * ------------------
 * O QUE FAZ: Limpa TODOS os dados salvos no localStorage.
 * 
 * COMO USAR: devLimparStorage()
 * 
    * Útil para simular um usuário novo (sem token, sem email lembrado).
 */
function devLimparStorage() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_EMAIL_KEY);
  mostrarToast("Storage limpo! Recarregue a página.", "sucesso");
}

/**
 * devVerificarToken()
 * -------------------
 * O QUE FAZ: Mostra no console o token JWT salvo.
 * 
 * COMO USAR: devVerificarToken()
 */
function devVerificarToken() {
  var token = pegarToken();
  if (token) {
    console.log("Token salvo:", token);
    // Decodifica o payload do token (parte do meio)
    var parts = token.split(".");
    if (parts.length === 3) {
      var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      console.log("Payload decodificado:", payload);
    }
  } else {
    console.log("Nenhum token salvo.");
  }
}
