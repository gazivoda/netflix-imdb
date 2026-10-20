import s from '../blog.module.css';
import { parseProse } from '../_lib/prose';

/** Inline rendering of already token-rendered prose: internal links and `[n]` citation markers. */
export function Prose({ text }: { text: string }) {
  return (
    <>
      {parseProse(text).map((n, i) => {
        if (n.kind === 'text') return n.text;
        if (n.kind === 'link') return <a key={i} href={n.href}>{n.text}</a>;
        return (
          <sup key={i} className={s.cite}>
            <a href={`#source-${n.n}`}>[{n.n}]</a>
          </sup>
        );
      })}
    </>
  );
}
