import ThemeToggle from './theme-toggle';
import CopyEmail from './copy-email';

const youtubeUrl = 'https://www.youtube.com/channel/UCV5sKnHaw5rjRTDelp-bw4g';

const projects = [
  {
    number: '01',
    kind: 'Ferramenta estudantil',
    title: 'AIA Fácil',
    description:
      'Calcula a média anual, estima a nota necessária na Avaliação Integrada Anual e converte a meta em acertos.',
    href: 'https://aia-facil-iffar-fw.proffernando.chatgpt.site/',
    accent: 'lime',
    image: '/projetos/aia-facil.webp',
    action: 'Calcular minha média',
  },
  {
    number: '02',
    kind: 'Atendimento de Física',
    title: 'Recuperação Paralela',
    description:
      'Organiza o agendamento semanal dos atendimentos de recuperação de Física no contraturno.',
    href: 'https://recuperacao-paralela-fisica.proffernando.chatgpt.site/',
    accent: 'blue',
    image: '/projetos/recuperacao-paralela.webp',
    action: 'Agendar atendimento',
  },
  {
    number: '03',
    kind: 'Observatório em tempo real',
    title: 'Clima Espacial',
    description:
      'Reúne atividade solar, manchas solares, vento solar, auroras e alertas com dados NOAA e NASA.',
    href: 'https://proffernando1.github.io/observatorios-clima/clima-espacial.html',
    accent: 'violet',
    image: '/projetos/clima-espacial.webp',
    action: 'Consultar atividade solar',
  },
  {
    number: '04',
    kind: 'Observatório climático',
    title: 'Aquecimento Global',
    description:
      'Apresenta séries de temperatura, CO₂, nível do mar, gelo ártico, emissões, impactos e cenários.',
    href: 'https://proffernando1.github.io/observatorios-clima/aquecimento-global.html',
    accent: 'orange',
    image: '/projetos/aquecimento-global.webp',
    action: 'Explorar dados climáticos',
  },
];

const education = [
  {
    year: 'Em curso',
    title: 'Doutorado em Educação — em andamento',
    institution: 'Universidade Regional Integrada do Alto Uruguai e das Missões · URI',
  },
  {
    year: '2014',
    title: 'Mestrado em Engenharia Mecânica',
    institution: 'Universidade Federal do Rio Grande do Sul · UFRGS',
  },
  {
    year: '2011',
    title: 'Licenciatura em Física',
    institution: 'Universidade Federal do Rio Grande do Sul · UFRGS',
  },
];

const networks = [
  {
    label: 'E-mail institucional',
    value: 'fernando.coelho@iffarroupilha.edu.br',
    href: 'mailto:fernando.coelho@iffarroupilha.edu.br',
  },
  {
    label: 'Currículo Lattes',
    value: 'Consultar meu currículo Lattes',
    href: 'https://lattes.cnpq.br/1242225581138619',
  },
  {
    label: 'YouTube',
    value: 'Visitar meu canal no YouTube',
    href: youtubeUrl,
  },
  {
    label: 'ORCID',
    value: '0009-0005-2285-8889',
    href: 'https://orcid.org/0009-0005-2285-8889',
  },
];

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Fernando José Vinhas Sousa Coelho',
  url: 'https://proffernando1.github.io',
  jobTitle: 'Professor EBTT de Física',
  worksFor: {
    '@type': 'CollegeOrUniversity',
    name: 'Instituto Federal Farroupilha — Campus Frederico Westphalen',
    url: 'https://www.iffarroupilha.edu.br/frederico-westphalen',
  },
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Universidade Federal do Rio Grande do Sul',
  },
  email: 'mailto:fernando.coelho@iffarroupilha.edu.br',
  sameAs: [
    'https://lattes.cnpq.br/1242225581138619',
    'https://orcid.org/0009-0005-2285-8889',
    youtubeUrl,
  ],
  knowsAbout: [
    'Ensino de Física',
    'Educação Profissional e Tecnológica',
    'Cultura maker',
    'Tecnologias educacionais',
    'Astronomia',
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Ir para o início">
          <span className="brand-mark" aria-hidden="true">FC</span>
          <span>Fernando Coelho</span>
        </a>
        <nav aria-label="Navegação principal">
          <ThemeToggle />
          <a href="#projetos">Projetos</a>
          <a href="#curriculo">Currículo</a>
          <a href="#contato">Contato e redes</a>
          <a className="nav-contact" href="mailto:fernando.coelho@iffarroupilha.edu.br">
            E-mail <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <nav className="mobile-nav" aria-label="Navegação da página">
        <a href="#projetos">Projetos</a>
        <a href="#curriculo">Currículo</a>
        <a href="#contato">Contato</a>
      </nav>

      <main id="conteudo">
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <p className="eyebrow">Professor EBTT de Física · IFFar</p>
            <h1>
              <span className="name-fernando">Fernando</span> José{' '}
              <span className="name-line">Vinhas Sousa <span className="name-coelho">Coelho</span></span>
            </h1>
            <p className="hero-intro">
              Professor de Física no Instituto Federal Farroupilha — Campus Frederico
              Westphalen e doutorando em Educação pela URI.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#projetos">
                Ver projetos <span aria-hidden="true">↓</span>
              </a>
              <a
                className="button button-quiet"
                href="https://lattes.cnpq.br/1242225581138619"
                target="_blank"
                rel="noreferrer"
              >
                Currículo Lattes <span aria-hidden="true">↗</span>
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </div>
          </div>

          <aside className="profile-card" aria-label="Pesquisa e projetos">
            <div className="profile-topline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="profile-logo"
                src="/fernando-coelho-monograma.webp"
                alt="Monograma FC de Fernando Coelho"
                width="256"
                height="256"
                loading="eager"
                decoding="async"
              />
              <div>
                <p className="profile-kicker">Pesquisa e projetos</p>
                <strong>Educação e Ensino</strong>
                <p className="profile-caption">Grupo de pesquisa · DGP/CNPq</p>
              </div>
            </div>
            <p className="profile-summary">Ensino, pesquisa, extensão e Laboratório IF Maker.</p>
          </aside>
        </section>

        <section className="projects-section" id="projetos" aria-labelledby="projetos-titulo">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recursos digitais</p>
              <h2 id="projetos-titulo">Projetos em acesso aberto</h2>
            </div>
            <p>
              Ferramentas para estudantes e para quem quer explorar a ciência.
              Os projetos abrem em uma nova aba.
            </p>
          </div>

          <div className="project-grid">
            {projects.map((project) => (
              <a
                className={`project-card ${project.accent}`}
                href={project.href}
                key={project.number}
                target="_blank"
                rel="noreferrer"
              >
                <div className="project-meta">
                  <span>{project.number}</span>
                  <span>{project.kind}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="project-preview" src={project.image}
                  alt={`Prévia da interface de ${project.title}`}
                  width="960" height="600" loading="lazy" decoding="async" />
                <div>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                </div>
                <span className="project-link">
                  {project.action} <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (abre em nova aba)</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="curriculum-section" id="curriculo" aria-labelledby="curriculo-titulo">
          <div className="curriculum-intro">
            <p className="eyebrow">Currículo resumido</p>
            <h2 id="curriculo-titulo">Formação e atuação</h2>
            <p>
              Doutorando em Educação pela Universidade Regional Integrada do Alto Uruguai
              e das Missões (URI), licenciado em Física e mestre em Engenharia Mecânica pela UFRGS.
              Desde 2018, integra o quadro docente do IFFar como professor EBTT de Física.
            </p>
            <a
              className="text-link"
              href="https://lattes.cnpq.br/1242225581138619"
              target="_blank"
              rel="noreferrer"
            >
              Consultar currículo completo <span aria-hidden="true">↗</span>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </div>

          <div className="curriculum-content">
            <ol className="education-list" aria-label="Formação acadêmica">
              {education.map((item) => (
                <li key={`${item.year}-${item.title}`}>
                  <span>{item.year}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.institution}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="areas-block">
              <p className="micro-heading">Áreas de atuação</p>
              <ul>
                <li>Ensino de Física</li>
                <li>Educação Profissional e Tecnológica</li>
                <li>Cultura maker e aprendizagem baseada em projetos</li>
                <li>Modelagem e impressão 3D</li>
                <li>Astronomia e divulgação científica</li>
                <li>Tecnologias educacionais</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contato" aria-labelledby="contato-titulo">
          <div className="contact-heading">
            <p className="eyebrow">Canais profissionais</p>
            <h2 id="contato-titulo">Contato e redes</h2>
            <p>
              Para assuntos acadêmicos, projetos de ensino, pesquisa, extensão e
              comunicação institucional.
            </p>
          </div>

          <div className="network-list">
            {networks.map((network, index) => (
              <div className="network-row" key={network.label}>
              <a href={network.href}
                target={network.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={network.href.startsWith('mailto:') ? undefined : 'noreferrer'}
              >
                <span className="network-number">0{index + 1}</span>
                <span className="network-label">{network.label}</span>
                <strong>{network.value}</strong>
                <span className="network-arrow" aria-hidden="true">↗</span>
                {!network.href.startsWith('mailto:') && (
                  <span className="sr-only"> (abre em nova aba)</span>
                )}
              </a>
              {network.href.startsWith('mailto:') && <CopyEmail />}
              </div>
            ))}
          </div>

          <div className="institution-link">
            <span>Vínculo institucional</span>
            <a
              href="https://www.iffarroupilha.edu.br/frederico-westphalen"
              target="_blank"
              rel="noreferrer"
            >
              IFFar — Campus Frederico Westphalen <span aria-hidden="true">↗</span>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </div>
        </section>
      </main>

      <footer>
        <span>© 2026 Fernando Coelho</span>
        <span>Frederico Westphalen · RS</span>
        <a href="#inicio">Voltar ao início <span aria-hidden="true">↑</span></a>
      </footer>
    </>
  );
}
