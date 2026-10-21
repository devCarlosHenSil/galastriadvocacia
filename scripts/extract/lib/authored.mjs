/**
 * The authored (not extracted) data of the site.
 *
 * Everything here comes from `docs/SPEC-DATA.md` §3.2.2, §3.4.5 and
 * `docs/SPEC-UI.md` §6.4/§6.7 — the copy that was reviewed by the owner and
 * is not present in the WordPress dump.
 */

/** The date of vigência of the version published on the new site. */
export const VIGENCIA = '19/10/2026';

/**
 * The same date, in ISO — it is the `updatedDate` of the frontmatter and the
 * `dateModified` of the JSON-LD (C8: uma única fonte de verdade).
 */
export const VIGENCIA_ISO = '2026-10-19';

/**
 * The version of the policies (C11).
 *
 * The consent records it: the Cookies Policy §8 promises "a data, as
 * categorias **e a versão vigente desta Política**".
 */
export const POLICY_VERSION = '2026-10-19';

/** The six blog posts (SPEC-DATA §3.2.2). */
export const BLOG_POSTS = Object.freeze([
  {
    id: 272,
    slug: '5aspectos-cruciais-direito-de-familia',
    description: 'O direito de família lida com as questões jurídicas que envolvem os relacionamentos familiares, incluindo casamento, filhos, sucessão e divisão de bens.',
    seoTitle: '5 Aspectos do Direito de Família que Você Deve Conhecer',
    seoDescription: 'Guarda de filhos, pensão alimentícia, divórcio, herança e sucessão: os 5 pontos essenciais do Direito de Família explicados pela Galastri Advocacia.',
  },
  {
    id: 610,
    slug: 'guarda-compartilhada',
    description: 'A guarda compartilhada é um modelo de convivência familiar que vem ganhando destaque nas decisões judiciais e na rotina de muitas famílias.',
    seoTitle: 'Guarda Compartilhada: 5 Pontos que Você Precisa Saber',
    seoDescription: 'Entenda como funciona a guarda compartilhada, quem decide sobre os filhos e quais são os direitos e deveres de cada pai no Brasil.',
  },
  {
    id: 714,
    slug: 'pis-pasep-2025',
    description: 'O PIS/Pasep 2025 é um benefício aguardado por muitos trabalhadores brasileiros que têm direito ao abono salarial.',
    seoTitle: 'PIS/Pasep 2025: Calendário, Regras e Como Consultar',
    seoDescription: 'Calendário do PIS/Pasep 2025, quem tem direito ao abono salarial e como consultar o seu pagamento no Portal do Trabalho.',
  },
  {
    id: 723,
    slug: 'jovem-aprendiz',
    description: 'O jovem aprendiz é uma excelente oportunidade para quem busca ingresso no mercado de trabalho enquanto ainda estuda.',
    seoTitle: 'Jovem Aprendiz Tem Direito a Seguro-Desemprego?',
    seoDescription: 'O jovem aprendiz tem direito ao seguro-desemprego? Veja a regra geral, a exceção prevista em lei e como solicitar o benefício.',
  },
  {
    id: 733,
    slug: 'salario-maternidade',
    description: 'O salário-maternidade é um direito garantido pela legislação brasileira para todas as trabalhadoras, com o objetivo de proporcionar um período de afastamento do trabalho após o nascimento de um filho.',
    seoTitle: 'Salário-maternidade pode ser prorrogado por complicações no parto',
    seoDescription: 'Entenda em que casos o salário-maternidade pode ser prorrogado por complicações no parto e como requerer a prorrogação junto ao INSS ou ao empregador.',
  },
  {
    id: 739,
    slug: 'bpc-loas-bloqueado',
    description: 'Se o seu BPC/Loas foi bloqueado, não se preocupe. Esse benefício, que garante um salário mínimo mensal para idosos e pessoas com deficiência em situação de vulnerabilidade social, pode ser regularizado rapidamente.',
    seoTitle: 'BPC/Loas Bloqueado? Veja Como Regularizar o Benefício',
    seoDescription: 'Seu BPC foi bloqueado? Veja os motivos mais comuns, como atualizar o Cadastro Único no Cras e voltar a receber o benefício.',
  },
]);

/** The three policy pages (SPEC-DATA §3.3). */
export const POLICY_PAGES = Object.freeze([
  {
    id: 3,
    slug: 'politica-de-privacidade',
    title: 'Política de Privacidade – Galastri Advocacia',
    description: 'A Galastri Advocacia se compromete a proteger a privacidade e os dados pessoais de seus clientes e visitantes. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos as informações obtidas por meio de nosso site e blog.',
    updatedDate: VIGENCIA_ISO,
  },
  {
    id: 83,
    slug: 'politica-de-cookies-galastri-advocacia',
    title: 'Política de Cookies – Galastri Advocacia',
    description: 'A Galastri Advocacia utiliza cookies para proporcionar uma melhor experiência ao usuário ao acessar nosso site e blog. Esta Política explica o que são cookies, como os utilizamos e como você pode gerenciá-los.',
    updatedDate: VIGENCIA_ISO,
  },
  {
    id: 85,
    slug: 'politica-de-uso-de-inteligencia-artificial-galastri-advocacia',
    title: 'Política de Uso de Inteligência Artificial – Galastri Advocacia',
    description: 'Na Galastri Advocacia, prezamos pela transparência e ética no uso de tecnologias, incluindo ferramentas baseadas em Inteligência Artificial (I.A.). Esta Política esclarece como utilizamos a I.A. em nossos serviços e plataformas digitais, assegurando que sua privacidade e confiança sejam respeitadas.',
    updatedDate: VIGENCIA_ISO,
  },
]);

/** The contact form (SPEC-DATA §3.4.5 + SPEC-UI §6.4/§6.7). */
export const FORM = Object.freeze({
  // D86 — o formulário publica **same-origin** para a **Pages Function** do
  // próprio site (`POST /api/contact`), que valida o payload e envia o
  // e-mail com o Resend.
  provider: 'cloudflare-pages-function',
  /**
   * The endpoint is **not** here: it is the environment variable
   * `PUBLIC_CONTACT_ENDPOINT` (o caminho da Function — não é um segredo).
   * O build **falha** se a variável não estiver definida (C20 — o placeholder
   * `FORM_ID` desapareceu).
   */
  endpointEnv: 'PUBLIC_CONTACT_ENDPOINT',
  emailTo: 'contato@galastriadvocacia.com.br',
  subject: 'Novo contato pelo site — Galastri Advocacia',
  method: 'POST',
  fields: [
    { name: 'nome', type: 'text', label: 'Nome completo', placeholder: 'Digite seu nome completo', required: true, mask: null, autocomplete: 'name', maxlength: 120 },
    { name: 'email', type: 'email', label: 'E-mail', placeholder: 'Digite seu e-mail', required: true, mask: 'email', autocomplete: 'email', maxlength: 254 },
    { name: 'telefone', type: 'tel', label: 'Telefone/WhatsApp', placeholder: 'Digite seu telefone com DDD', required: true, mask: 'phone', autocomplete: 'tel', maxlength: 19 },
    { name: 'mensagem', type: 'textarea', label: 'Mensagem', placeholder: 'Conte brevemente o seu caso:', required: true, mask: null, autocomplete: null, minlength: 20, maxlength: 4000 },
  ],
  honeypot: { name: '_gotcha', type: 'text' },
  submitLabel: 'Enviar mensagem',
  submittingLabel: 'Enviando…',
  successMessage: 'Mensagem enviada com sucesso! Em breve, nossa equipe entrará em contato.',
  errorMessage: 'Não foi possível enviar sua mensagem. Por favor, tente novamente ou fale conosco pelo WhatsApp.',
  fieldErrors: {
    nome: 'Informe seu nome completo.',
    email: 'Informe um e-mail válido.',
    telefone: 'Informe um telefone válido com DDD.',
    mensagem: 'Descreva brevemente o seu caso (mínimo 20 caracteres).',
  },
  whatsappCta: {
    label: 'Prefere falar agora? Fale com a gente pelo WhatsApp',
    href: 'https://wa.me/5511985665992',
  },
  privacyConsent: {
    required: true,
    label: 'Li e autorizo o tratamento dos meus dados pessoais para contato, conforme a Política de Privacidade.',
    link: '/politica-de-privacidade/',
    // D86 — o texto legal do consentimento mudou (o Resend é agora um
    // operador). **PENDENTE DE APROVAÇÃO DO ADVOGADO.**
    helper: 'Os dados serão utilizados apenas para o retorno do contato e tratados pelo Resend (operador de e-mail), conforme a Política de Privacidade.',
    error: 'É necessário autorizar o tratamento de dados para enviar a mensagem.',
  },
  colors: {
    fieldBg: '#2E2E2ECF',
    fieldBorder: '#F3F3F34D',
    fieldBorderFocus: '#E8C79A',
    fieldRadius: 30,
    label: '#F3F3F3',
    inputText: '#F3F3F3',
    buttonBackground: '#BC9265',
    buttonText: '#2E2E2E',
    buttonHoverBackground: '#C9A377',
    successBackground: '#0C884A',
    successText: '#0A7240',
    errorBackground: '#C1121F',
    errorText: '#C1121F',
    infoBackground: '#1C77BE',
  },
  masks: {
    phone: { pattern: '^\\(\\d{2}\\)\\s\\d{4,5}-\\d{4}$', placeholder: '(11) 99999-9999' },
    email: { pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$', placeholder: 'voce@email.com' },
  },
});

/** The SEO copy of the pages that are not posts (SPEC-DATA §3.4.6). */
export const SEO_PAGES = Object.freeze({
  '/blog/': {
    title: 'Blog | Artigos de Direito Civil, Trabalhista e Previdenciário',
    description: 'Artigos sobre direito de família, direito do trabalho e direito previdenciário escritos pela equipe da Galastri Advocacia, em Jundiaí-SP.',
  },
  '/category/direito-de-familia/': {
    title: 'Direito de Família | Galastri Advocacia',
    description: 'Artigos sobre guarda de filhos, pensão alimentícia, divórcio e herança escritos pela Galastri Advocacia, em Jundiaí-SP.',
  },
  '/category/direito-do-trabalho/': {
    title: 'Direito do Trabalho | Galastri Advocacia',
    description: 'Artigos sobre PIS/Pasep, seguro-desemprego, jovem aprendiz e benefícios trabalhistas escritos pela Galastri Advocacia.',
  },
  '/category/direito-previdenciario/': {
    title: 'Direito Previdenciário | Galastri Advocacia',
    description: 'Artigos sobre salário-maternidade, BPC/Loas e benefícios do INSS escritos pela Galastri Advocacia, em Jundiaí-SP.',
  },
  '/politica-de-privacidade/': {
    title: 'Política de Privacidade | Galastri Advocacia',
    description: 'Saiba como a Galastri Advocacia coleta, utiliza, armazena e protege os seus dados pessoais, conforme a LGPD.',
  },
  '/politica-de-cookies-galastri-advocacia/': {
    title: 'Política de Cookies | Galastri advocacia',
    description: 'Entenda quais cookies a Galastri Advocacia utiliza, para que servem e como gerenciá-los no seu navegador.',
  },
  '/politica-de-uso-de-inteligencia-artificial-galastri-advocacia/': {
    title: 'Política de Uso de Inteligência Artificial | Galastri Advocacia',
    description: 'Conheça como a Galastri Advocacia utiliza inteligência artificial em seus serviços e plataformas, com transparência e revisão jurídica.',
  },
  '/links/': {
    title: 'Links Úteis | Galastri Advocacia',
    description: 'Links para agendamento de consulta, Instagram e informações institucionais da Galastri Advocacia.',
  },
  '/404': {
    title: 'Página não encontrada | Galastri Advocacia',
    description: 'A página que você procura não existe ou foi movida.',
    // A 404 não pode ser indexada nem declarar-se canónica (soft-404).
    robots: 'noindex, follow',
    canonical: null,
  },
});

/** The contact section copy (SPEC-UI §6.7). */
export const CONTACT_COPY = Object.freeze({
  subtitle: 'Agende sua reunião preenchendo o formulário abaixo:',
});

/**
 * The overlay of the two policies of the LGPD (SPEC-SECURITY §5.2, §5.3, §5.4).
 *
 * The text of the WordPress (2024) says things that are no longer true — the
 * site is static, it has no comments, no accounts and no plugins, and the
 * form is processed by a Pages Function of the site itself. The overlay is
 * **authored**: it is
 * applied by the extractor, so the correction survives every
 * `npm run extract` and is never lost in a hand edit of the generated file.
 *
 * ⚠️ The appended text is **pending the lawyer's approval** — the marker
 * comment says so in the published document.
 */

/**
 * The marker of a **passage altered inside the original text** (the appended
 * block has its own marker). D86 — the processor of the form is now the
 * Resend (the e-mail) and the Cloudflare (the hosting).
 */
const MARKER_PASSAGE = () =>
  '<!-- LGPD: texto alterado na migração para a Cloudflare Pages (D86) — PENDENTE DE APROVAÇÃO DO ADVOGADO. Não editar à mão: o texto é gerado por scripts/extract/index.mjs a partir de scripts/extract/lib/authored.mjs. -->';

/** The marker comment that opens the appended text. */
const MARKER = () =>
  '<!-- LGPD: secções acrescentadas na migração (SPEC-SECURITY §5.2/§5.3) — PENDENTE DE APROVAÇÃO DO ADVOGADO. Não editar à mão: o texto é gerado por scripts/extract/index.mjs a partir de scripts/extract/lib/authored.mjs. -->';

/**
 * The overlay of the Policy of Privacy (post 3).
 *
 * - `replacements` — the fragments of the original text that are wrong.
 * - `sections` — the sections of the original that are replaced.
 * - `append` — the text appended at the end.
 */
export const PRIVACY_OVERLAY = Object.freeze({
  slug: 'politica-de-privacidade',
  // C8 — a numeração das secções é sequencial (1…N) depois do anexo.
  renumberSections: true,
  // U19 - o contorno do documento: h1 -> h2 (o WordPress usava h4).
  demoteHeadings: [{ from: 'h4', to: 'h2' }],
  /** the fragments of the original text that are corrected (§5.4 items 1, 2, 4) */
  replacements: [
    {
      from: 'Nome, e-mail, telefone e outras informações fornecidas voluntariamente através de formulários de contato ou assinatura de newsletter;',
      to: 'Nome, e-mail, telefone e outras informações fornecidas voluntariamente através de formulários de contato;',
      kind: 'newsletter removida (§5.4 item 1)',
    },
    {
      from: '<li>Enviar atualizações, artigos e informações relacionadas ao conteúdo jurídico do blog;</li>',
      to: '<li>Não aplicável: este site não envia newsletter, atualizações de conteúdo nem comunicações de marketing — o contacto depende sempre de você o solicitar através do formulário de contato;</li>',
      kind: 'a finalidade da newsletter que não existe é declarada não aplicável (C11e)',
    },
    {
      from: 'Dados de navegação, como endereço IP, tipo de navegador, páginas acessadas, tempo de permanência no site e cookies.',
      to: `${MARKER_PASSAGE()}Este site é um website estático e <strong>não coleta</strong> dados de navegação (endereço IP, tipo de navegador, páginas acessadas, tempo de permanência) por conta própria. Quem os coleta é o Google (Google Tag Manager, Google AdSense e Google Maps), apenas depois do seu consentimento, e o Resend, apenas no envio do formulário de contato. O único dado que este site guarda no seu navegador é o registo da sua escolha, em armazenamento local (localStorage) (ver a seção 6).`,
      kind: 'dados de navegação reescritos (§5.4 item 2)',
    },
    {
      from: 'e-mail: <a href="mailto:contato@galastriadvocacia.com.br">contato@galastriadvocacia.com.br</a>.',
      to: 'e-mail: <a href="mailto:contato@galastriadvocacia.com.br">contato@galastriadvocacia.com.br</a>. O canal do encarregado (DPO) e o prazo de resposta estão na seção 14.',
      kind: 'canal do encarregado (§5.4 item 6)',
    },
  ],
  /** the sections of the original that are replaced by the new text */
  sections: [
    {
      /** the section 6 of the original ("Cookies") */
      heading: '6\\.\\s*<strong>Cookies</strong>',
      kind: 'cookies próprios e de terceiros (§5.2, secções 6 a 8)',
      content: `<p>Este site é um website estático: não possui banco de dados, painel administrativo, cadastro de usuários nem sistema de comentários. O único dado que este site guarda no seu navegador é o <strong>registo da sua escolha em armazenamento local (localStorage)</strong>, utilizado exclusivamente para lembrar a sua escolha e permitir que você a revogue a qualquer momento. Nenhum dado guardado localmente é utilizado para identificar, rastrear ou perfilar você além dessa finalidade.</p>

<h4>7. <strong>Cookies de terceiros: Google Tag Manager e Google AdSense</strong></h4>

<p>Este site utiliza o <strong>Google Tag Manager</strong> (ID do container: GTM-KDNG3QWB) e o <strong>Google AdSense</strong> (ID do anunciante: ca-pub-5989678973778468), operados pelo <strong>Google LLC</strong>, empresa com sede nos Estados Unidos.</p>

<p>O carregamento desses recursos e a gravação de cookies de publicidade comportamental (incluindo os cookies <code>IDE</code>, <code>test_cookie</code> e <code>_gcl_au</code>, do domínio <code>doubleclick.net</code>) <strong>somente ocorrem após o seu consentimento</strong> para a categoria "Publicidade", obtido na janela de consentimento exibida na primeira visita. Você pode aceitar, recusar ou gerenciar suas preferências a qualquer momento pelo link <strong>"Gerenciar preferências de cookies"</strong>, disponível em todas as páginas, bem como pela ferramenta do Google em <a href="https://adssettings.google.com">adssettings.google.com</a> e <a href="https://myaccount.google.com/ads-data">myaccount.google.com/ads-data</a>.</p>

<p>O Google, como controlador independente, trata os dados pessoais coletados conforme as suas próprias políticas de privacidade e os termos de publicidade do Google Ads.</p>

<h4>8. <strong>Mapa do Google Maps</strong></h4>

<p>O mapa do escritório é exibido por meio de um quadro (iframe) do <strong>Google Maps</strong> (Google LLC, Estados Unidos). O carregamento desse quadro pode permitir que o Google receba dados técnicos do seu navegador, tais como endereço IP, agente do usuário e cookies próprios do Google. O mapa não é carregado de forma automática antes da sua interação, e a sua inclusão depende da sua escolha.</p>`,
    },
  ],
  /** the text appended at the end of the document */
  append: `${MARKER()}

<h4>9. <strong>Envio do formulário de contato</strong></h4>

<p>Os dados enviados pelo formulário de contato (<strong>nome, e-mail, telefone e mensagem</strong>) são transmitidos, de forma criptografada (HTTPS), à infraestrutura do próprio site (<strong>Cloudflare Inc.</strong>, empresa sediada nos Estados Unidos, onde o site está alojado) e são encaminhados ao endereço de e-mail institucional do escritório pelo <strong>Resend, Inc.</strong>, também sediada nos Estados Unidos, que atua como <strong>operadora</strong> (subencarregada) do tratamento.</p>

<p>A proteção contra envios automatizados é feita pelo próprio site, <strong>sem recurso a CAPTCHA de terceiros</strong>: um campo oculto que só um programa automático preencheria (honeypot), a verificação do tempo decorrido desde a abertura da página e um limite de submissões por endereço IP. Nenhum destes mecanismos coloca cookies no navegador de quem envia a mensagem.</p>

<p>Os dados do formulário são conservados pelo prazo necessário ao atendimento da solicitação e ao cumprimento de obrigações legais ou regulatórias, <strong>conforme o contrato mantido com o operador</strong>, findo o qual são eliminados ou anonimizados.</p>

<p><strong>Não solicitamos dados pessoais sensíveis.</strong> Orientamos a não enviar, por este formulário, informações relativas a saúde, orientação sexual, biometria, dados de crianças e adolescentes, dados fiscais detalhados, número de processo judicial ou qualquer outra informação relativa a cliente potencial, devendo todo e qualquer tratamento de dados dessa natureza ocorrer por canal privado e seguro, com o cliente.</p>

<h4>10. <strong>Ausência de comentários e de conteúdo enviado por usuários</strong></h4>

<p>Este site <strong>não possui sistema de comentários, fóruns, cadastro de usuários ou espaço de publicação aberta</strong>. O sistema de comentários da antiga plataforma foi desativado e <strong>nenhum comentário, endereço de e-mail ou conteúdo enviado por visitantes é coletado, exibido ou armazenado</strong>. Todo o conteúdo publicado é redigido e publicado pela Galastri Advocacia.</p>

<h4>11. <strong>Transferência internacional de dados</strong></h4>

<p>Parte do tratamento de dados pessoais deste site é realizado por operadores com sede fora do Brasil — notavelmente <strong>Google LLC</strong> (Tag Manager, AdSense e Maps), <strong>Cloudflare Inc.</strong> (entrega e alojamento do site) e <strong>Resend, Inc.</strong> (envio do e-mail do formulário de contato) — nos Estados Unidos e, eventualmente, em outros países.</p>

<p>Essa transferência internacional é realizada em observância ao <strong>art. 33 da LGPD</strong> e à <strong>Resolução CD/ANPD nº 19/2024</strong>, mediante os mecanismos de transferência internacional previstos na regulamentação aplicável, e com as garantias contratuais e de proteção de dados cabíveis.</p>

<h4>12. <strong>Prazo de retenção</strong></h4>

<ul>
<li><strong>Formulários de contato:</strong> os dados são mantidos pelo prazo necessário ao atendimento da solicitação e ao cumprimento de obrigações legais ou regulatórias, <strong>conforme o contrato mantido com o operador</strong>, sendo, então, eliminados ou anonimizados.</li>
<li><strong>Registros de consentimento de cookies:</strong> mantidos enquanto o consentimento estiver vigente e pelo prazo necessário à demonstração de conformidade, nos termos do art. 6º, X, da LGPD.</li>
<li><strong>Registos técnicos do tratamento do formulário:</strong> o registo da aplicação que recebe a mensagem guarda apenas o resultado, o estado e a duração do pedido e um prefixo do hash do endereço IP (para proteger o site de envios automatizados) — <strong>nunca</strong> o nome, o e-mail, o telefone ou o conteúdo da mensagem. Os registos são mantidos por prazo tecnicamente justificado e depois eliminados ou anonimizados.</li>

<li><strong>Logs de acesso e segurança (quando existentes):</strong> mantidos por prazo tecnicamente justificado, normalmente de 30 a 90 dias.</li>
</ul>

<h4>13. <strong>Atualização desta Política</strong></h4>

<p>Esta Política pode ser atualizada para refletir mudanças no site ou na legislação aplicável. A data de vigência da versão vigente é indicada no início deste documento. Alterações relevantes serão comunicadas por meio do próprio site.</p>

<h4>14. <strong>Encarregado (DPO) e exercício de direitos</strong></h4>

<p>O encarregado pelo tratamento dos dados pessoais (DPO) é a <strong>Galastri Advocacia</strong>, e o canal de contacto é o mesmo do formulário de contacto: <a href="mailto:contato@galastriadvocacia.com.br">contato@galastriadvocacia.com.br</a> e o telefone <a href="tel:5511985665992">+55 11 98566-5992</a>.</p>

<p>Nos termos do <strong>art. 18 da LGPD</strong>, o titular pode, a qualquer momento, solicitar a confirmação do tratamento, o acesso, a correção, a anonimização, o bloqueio ou a eliminação dos seus dados, bem como a informação sobre a partilha, o cancelamento e a revogação do consentimento. O escritório responde em <strong>15 dias</strong>, conforme o art. 19, §3º, da LGPD.</p>

<p>Sem resposta satisfatória, o titular pode apresentar reclamação à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.</p>`,
});

/**
 * The overlay of the Policy of Cookies (post 83).
 */
export const COOKIES_OVERLAY = Object.freeze({
  slug: 'politica-de-cookies-galastri-advocacia',
  // C8 — a numeração das secções é sequencial (1…N) depois do anexo.
  renumberSections: true,
  // U19 - o contorno do documento: h1 -> h2 (o WordPress usava h4 e o titulo
  // repetido no corpo era um h3).
  demoteHeadings: [
    { from: 'h4', to: 'h2' },
    { from: 'h3', to: 'h2' },
  ],
  replacements: [
    {
      from: '<li><strong>Ferramentas de Redes Sociais:</strong> Para integração de funcionalidades como botões de compartilhamento (ex.: Facebook, LinkedIn e Instagram).</li>',
      to: '<li><strong>Google AdSense:</strong> Para exibição de publicidade, apenas depois do seu consentimento para a categoria "Publicidade".</li>',
      kind: 'os plugins e as redes sociais saem (§5.4 item 4)',
    },
  ],
  sections: [
    {
      /** the section 2 of the original ("Como Utilizamos os Cookies?") — the
       *  three categories that really exist (C11b) */
      heading: '2\\.\\s*<strong>Como Utilizamos os Cookies\\?</strong>',
      kind: 'as categorias reais de cookies (C11b)',
      content: `<p>O site utiliza quatro categorias, que correspondem às quatro opções da janela de consentimento:</p>

<ul>
<li><strong>Necessários:</strong> indispensáveis ao funcionamento do site. Não podem ser desativados e não dependem do consentimento, porque são os que guardam, no seu navegador, o registo da sua escolha (armazenamento local) e os que asseguram a segurança e o funcionamento básico das páginas.</li>

<li><strong>Analíticos:</strong> permitem medir o número de visitantes e as páginas mais lidas. Só são carregados depois de aceitar esta categoria e ficam a cargo do Google (Google Tag Manager).</li>

<li><strong>Publicidade:</strong> permitem a exibição de publicidade e a medição das campanhas. Só são carregados depois de aceitar esta categoria e ficam a cargo do Google (Google AdSense).</li>

<li><strong>Mapas:</strong> permitem mostrar o mapa do escritório (Google Maps) na página de contacto. Só é carregado depois de aceitar esta categoria; até lá, o mapa é um espaço reservado com um link para o Google Maps.</li>
</ul>

<p>Não utilizamos cookies de desempenho, de funcionalidade ou de marketing para além das categorias acima descritas.</p>`,
    },
    {
      heading: '3\\.\\s*<strong>Cookies de Terceiros</strong>',
      kind: 'terceiros utilizados (§5.3, secção 7)',
      content: `<p>Este site utiliza os seguintes terceiros:</p>

<table>
<thead>
<tr><th>Terceiro</th><th>Finalidade</th><th>Categoria</th><th>Endereço</th></tr>
</thead>
<tbody>
<tr><td>Google Tag Manager (GTM-KDNG3QWB)</td><td>Carregamento de tags, analytics e publicidade</td><td>Publicidade / Analítica (conforme consentimento)</td><td>https://www.googletagmanager.com</td></tr>
<tr><td>Google AdSense (ca-pub-5989678973778468)</td><td>Exibição de publicidade</td><td>Publicidade</td><td>https://googleads.g.doubleclick.net</td></tr>
<tr><td>Google Maps</td><td>Exibição do mapa do escritório</td><td>Mapas — carregado apenas depois de aceitar a categoria "Mapas"</td><td>https://www.google.com/maps</td></tr>
<tr><td>Cloudflare (CDN, proxy e alojamento)</td><td>Entrega das páginas, alojamento do site, receção das mensagens do formulário de contacto, proteção contra ataques e aplicação das regras de segurança do site</td><td>Necessário à entrega (o proxy processa o endereço IP de cada visitante e pode gravar o cookie <code>__cf_bm</code>)</td><td>https://www.cloudflare.com</td></tr>
<tr><td>GitHub (repositório e verificação automática)</td><td>Código-fonte do site, histórico das revisões e verificação de segurança automática</td><td>Necessário à entrega (o repositório é público; o pedido do visitante não é transmitido ao GitHub)</td><td>https://github.com</td></tr>
</tbody>
</table>

<p>O Google Tag Manager e o Google AdSense <strong>não são carregados</strong> antes da sua escolha na janela de consentimento. O mapa do escritório é carregado apenas depois de você aceitar pelo menos uma das categorias opcionais, e o formulário tem o seu carregamento descrito na Política de Privacidade.</p>

<p>O Cloudflare e o GitHub são <strong>infraestrutura de entrega</strong>: o Cloudflare recebe o endereço IP de cada visitante para entregar a página, <strong>independentemente do consentimento</strong>, e pode gravar o cookie <code>__cf_bm</code> (proteção contra bots) antes de qualquer escolha. O GitHub não recebe pedidos dos visitantes: apenas hospeda o código-fonte e as verificações de segurança. A base legal é o interesse legítimo em proteger e entregar o site, nos termos do art. 7º, IX, da LGPD. A transferência internacional de dados para os Estados Unidos está regulada na Política de Privacidade.</p>

<p>Os cookies de terceiros seguem as políticas próprias de privacidade e cookies dessas plataformas.</p>`,
    },
  ],
  append: `${MARKER()}

<h4>7. <strong>Como revogar o consentimento</strong></h4>

<p>A qualquer momento, pelo link <strong>"Gerenciar preferências de cookies"</strong>, disponível em todas as páginas. Você pode também limpar os cookies do seu navegador. O consentimento é tão fácil de revogar quanto de conceder.</p>

<h4>8. <strong>Registro do consentimento</strong></h4>

<p>A sua escolha — a data e a hora, as categorias aceitas e a versão vigente desta Política — fica <strong>guardada no seu próprio navegador</strong>, em armazenamento local (<code>localStorage</code>). Ela <strong>não</strong> é transmitida ao escritório, que <strong>não</strong> tem um registo de consentimentos no servidor, e é apagada quando você limpa os dados do navegador. O escritório apoia-se no dever de demonstração (art. 6º, X, da LGPD) através de evidência técnica: os pedidos às categorias opcionais só são enviados depois da sua escolha e, enquanto não a faz, elas permanecem <strong>negadas</strong>.</p>`,
});

/**
 * The overlay of the Policy of the Use of Artificial Intelligence (post 85).
 *
 * The review (SPEC-SECURITY §5, SEC-64) asked for the privacy and the cookies
 * policies; the IA policy is aligned with the Privacy Policy (C12) — it
 * described a collection of navigation data that the site does not make.
 */
export const AI_OVERLAY = Object.freeze({
  slug: 'politica-de-uso-de-inteligencia-artificial-galastri-advocacia',
  // C8 — a numeração das secções é sequencial (1…N) depois do anexo.
  renumberSections: true,
  // U19 - o contorno do documento: h1 -> h2 (o WordPress usava h4).
  demoteHeadings: [{ from: 'h4', to: 'h2' }],
  replacements: [
    {
      // C12 — o texto dizia que a I.A. "pode ser usada para identificar padrões
      // de navegação", o que contradiz a Política de Privacidade (§1 e §2: o
      // site é estático e não coleta dados de navegação por conta própria).
      from: '<li><strong>Análise de Dados:</strong> Ferramentas de I.A. podem ser usadas para identificar padrões de navegação e aprimorar a experiência do usuário no site, garantindo um ambiente intuitivo e funcional.</li>',
      to: '<li><strong>Análise de Dados:</strong> <strong>Não aplicável.</strong> Este site é um website estático e não coleta dados de navegação (endereço IP, tipo de navegador, páginas acessadas, tempo de permanência) por conta própria, pelo que não são utilizadas ferramentas de I.A. para identificar padrões de navegação. A recolha de dados de navegação, quando ocorre, é feita exclusivamente pelo Google (Google Tag Manager, Google AdSense e Google Maps) e apenas depois do seu consentimento, conforme a Política de Privacidade.</li>',
      kind: 'a análise de dados alinhada com a Política de Privacidade (C12)',
    },
    {
      from: '<li><strong>Confidencialidade:</strong> Dados fornecidos por meio do site ou blog não são utilizados para treinar modelos de I.A. ou compartilhados com terceiros para fins de desenvolvimento de tecnologias.</li>',
      to: '<li><strong>Confidencialidade:</strong> Dados fornecidos por meio do site ou blog não são utilizados para treinar modelos de I.A. ou compartilhados com terceiros para fins de desenvolvimento de tecnologias. Esta Política rege o conteúdo editorial do site; o tratamento dos dados pessoais está descrito na Política de Privacidade.</li>',
      kind: 'a remissão para a Política de Privacidade (C12)',
    },
  ],
  sections: [],
});

/**
 * The alt texts corrected by SPEC-UI §4.4 (U21a, U21b, U8).
 *
 * The key is the id of the Elementor element. An empty alt marks a decorative
 * image (the name is already in the adjacent heading).
 */
export const IMAGE_ALT_REPAIRS = Object.freeze({
  // The avatar of the "Sobre" section.
  '4b8b744': 'Retrato da Dra. Ana Paula Galastri, fundadora do escritório',
  // The avatar of the "Nossa Equipe" — the name is in the adjacent heading.
  'ea6573c': '',
  // The logo of the footer.
  'c34d807': 'Galastri Advocacia',
});

/** The two overlays, by the slug of the page. */
export const POLICY_OVERLAYS = Object.freeze({
  [PRIVACY_OVERLAY.slug]: PRIVACY_OVERLAY,
  [COOKIES_OVERLAY.slug]: COOKIES_OVERLAY,
  [AI_OVERLAY.slug]: AI_OVERLAY,
});
