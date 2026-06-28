import { useEffect, useState } from 'react';
import { toDataUrl } from '@/lib/qr';

/**
 * QR-Code zur Handy-Fernbedienung. Die Remote-URL trägt seit dem Auth-Token (2b)
 * einen langen Query-Parameter, der sich am Handy kaum abtippen lässt — der QR
 * macht das Einklinken per Scan möglich (wie bei JM Q&A / Battle).
 */
export function RemoteQr({ url }: { url: string }): React.JSX.Element | null {
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (url) {
      void toDataUrl(url)
        .then((d) => !cancelled && setQr(d))
        .catch(() => !cancelled && setQr(''));
    } else {
      setQr('');
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!qr) return null;
  return (
    <img
      src={qr}
      alt="QR-Code zur Handy-Fernbedienung"
      width={160}
      height={160}
      className="mx-auto rounded-lg bg-white p-1.5"
    />
  );
}
