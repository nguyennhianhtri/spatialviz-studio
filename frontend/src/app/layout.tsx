import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
export const metadata: Metadata = {title:'SpatialViz Studio — a new perspective on your space',description:'Turn a floor plan into a space to explore. Review room dimensions against your original plan, refine the layout, and create an interactive 3D view.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}<Toaster position="bottom-right" toastOptions={{style:{background:'#faf9f4',color:'#30392f',border:'1px solid #deded2'}}}/></body></html>;}
