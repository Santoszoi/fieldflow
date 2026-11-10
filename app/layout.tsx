import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'FieldFlow | Operação em campo',description:'Visitas técnicas organizadas, da agenda à conclusão. Um projeto Marcos Solutions.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
