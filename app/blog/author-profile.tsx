import Portrait from '../portrait';

export const authorBiography = 'Possui graduação em Licenciatura em Física pela Universidade Federal do Rio Grande do Sul (UFRGS) e mestrado em Engenharia Mecânica pela Universidade Federal do Rio Grande do Sul (UFRGS). É Professor EBTT de Física do Instituto Federal Farroupilha (IFFar), Campus Frederico Westphalen, em regime de dedicação exclusiva. Atua principalmente nas áreas de Ensino de Física, Educação Profissional e Tecnológica, tecnologias educacionais, cultura maker, aprendizagem baseada em projetos, modelagem e impressão 3D, Astronomia, divulgação científica e formação de estudantes na educação básica, técnica e tecnológica. Desenvolve e participa de projetos de ensino, pesquisa e extensão, com experiência em coordenação de atividades vinculadas ao Laboratório Maker, orientação de trabalhos acadêmicos e participação em bancas, comissões e ações institucionais. Participa do grupo de pesquisa Educação e Ensino, vinculado ao IF-Farroupilha';

export default function AuthorProfile() {
  return <aside className="blog-author-profile" aria-labelledby="blog-about-title">
    <Portrait />
    <div className="blog-author-bio">
      <div className="blog-author-heading">
        <p className="eyebrow">Sobre o autor</p>
        <h2 id="blog-about-title">Fernando Coelho</h2>
      </div>
      <p className="blog-author-biography">{authorBiography}</p>
    </div>
  </aside>;
}
