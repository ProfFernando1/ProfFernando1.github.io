'use client';

import { useState } from 'react';

const email = 'fernando.coelho@iffarroupilha.edu.br';

export default function CopyEmail() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="copy-email">
      <button type="button" onClick={copyEmail}>Copiar e-mail</button>
      <span role="status">
        {status === 'copied' && 'E-mail copiado.'}
        {status === 'error' && 'Não foi possível copiar. Selecione o endereço acima para copiá-lo.'}
      </span>
    </div>
  );
}
