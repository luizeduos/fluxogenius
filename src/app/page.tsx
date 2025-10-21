"use client";
import React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Code, Link, Trash2, Plus, ZoomIn, ZoomOut, Grid, Download, Upload, FileImage, GitCommitVertical, Sparkles, BrainCircuit, AlertTriangle, X, Table, MousePointer2, FileText, BotMessageSquare } from 'lucide-react';
import { nanoid } from 'nanoid';
import ReactMarkdown from 'react-markdown';

// --- DEFINIÇÕES DE TIPO (TYPESCRIPT) ---
type SymbolType = 'start' | 'end' | 'input' | 'process' | 'display' | 'write';
type VariableType = 'real' | 'inteiro' | 'caractere';

// Tipos para as bibliotecas carregadas dinamicamente
interface HtmlToImageOptions {
  backgroundColor?: string;
  pixelRatio?: number;
}
declare global {
  interface Window {
    htmlToImage: {
      toPng: (element: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
    };
    jspdf: {
      jsPDF: new (options?: object) => any;
      autoTable: (options: object) => void;
    };
    Prism: {
      highlightAll: () => void;
      highlight: (text: string, grammar: any, language: string) => string;
      languages: {
        cpp: any;
        pascal: any;
      };
    };
  }
}

interface BlockNode {
  id: string;
  type: SymbolType;
  text: string;
  variableType?: VariableType;
  position: { x: number; y: number };
  width: number;
  height: number;
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

// --- CONFIGURAÇÃO DOS SÍMBOLOS ---
const SYMBOL_CONFIG = {
  start: { label: 'Início', shape: 'pill' },
  end: { label: 'Fim', shape: 'pill' },
  input: { label: 'Entrada (leia)', shape: 'parallelogram' },
  process: { label: 'Processo (<-)', shape: 'rectangle' },
  display: { label: 'Saída (escreval)', shape: 'display' },
  write: { label: 'Saída (escreva)', shape: 'hexagon' },
};

// --- FUNÇÕES AUXILIARES ---
const removeCodeComments = (code: string, commentSymbol: '//' | '--') => {
    if (!code) return '';
    return code.split('\n').map(line => line.split(commentSymbol)[0].trimEnd()).filter(line => line.trim() !== '').join('\n');
};


// --- COMPONENTES AUXILIARES ---

type Toast = {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
};

const ToastNotification: React.FC<{
  toast: Toast;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  const theme = {
    error: { icon: <AlertTriangle className="text-red-500" size={20} />, barColor: 'bg-red-500' },
    warning: { icon: <AlertTriangle className="text-yellow-500" size={20} />, barColor: 'bg-yellow-500' },
    info: { icon: <AlertTriangle className="text-blue-500" size={20} />, barColor: 'bg-blue-500' },
    success: { icon: <Sparkles className="text-green-500" size={20} />, barColor: 'bg-green-500' }
  };

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 5000);
    return () => clearTimeout(timer);
  }, [handleDismiss]);

  return (
    <div className={`flex items-start w-full max-w-sm bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transition-all duration-300 transform ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
      <div className={`w-1.5 h-full ${theme[toast.type].barColor}`} />
      <div className="flex items-center p-3 gap-3"><div className="flex-shrink-0">{theme[toast.type].icon}</div><p className="text-sm font-medium text-slate-800">{toast.message}</p></div>
      <button onClick={handleDismiss} className="ml-auto p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded-full m-1"><X size={16} /></button>
    </div>
  );
};

const NodeComponent: React.FC<{
  node: BlockNode; isSelected: boolean; onSelect: (id: string) => void; onDragStart: (e: React.MouseEvent, id: string) => void; onDoubleClick: (id: string) => void; onDelete: (id: string) => void;
}> = ({ node, isSelected, onSelect, onDragStart, onDoubleClick, onDelete }) => {
  const getSymbolShapeStyle = () => {
    const config = SYMBOL_CONFIG[node.type];
    switch (config.shape) {
      case 'parallelogram': return { clipPath: 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)' };
      case 'display': return { clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%)' };
      case 'hexagon': return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' };
      case 'pill': return { borderRadius: '9999px' };
      case 'rectangle': default: return { borderRadius: '0.5rem' };
    }
  };
  return (
    <div id={node.id} className={`absolute flex items-center justify-center p-2 text-center text-slate-800 bg-slate-100 border-2 cursor-move shadow-md hover:border-indigo-500 hover:z-20 transition-all duration-150 ${isSelected ? 'border-red-500 ring-4 ring-red-500/30 z-10' : 'border-slate-700'}`} style={{ left: node.position.x, top: node.position.y, width: node.width, height: node.height, ...getSymbolShapeStyle() }} onMouseDown={(e) => onDragStart(e, node.id)} onClick={(e) => { e.stopPropagation(); onSelect(node.id); }} onDoubleClick={() => onDoubleClick(node.id)}>
      <span className="pointer-events-none select-none whitespace-pre-wrap">{node.text}</span>
      {isSelected && (<button className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Excluir Bloco">&times;</button>)}
    </div>
  );
};

const Arrow: React.FC<{
  connectionId: string; fromNode: BlockNode; toNode: BlockNode; isHovered: boolean; onDelete: (id: string) => void; onHover: (id: string | null) => void;
}> = ({ connectionId, fromNode, toNode, isHovered, onDelete, onHover }) => {
  const P1 = { x: fromNode.position.x + fromNode.width / 2, y: fromNode.position.y + fromNode.height / 2 };
  const P4 = { x: toNode.position.x + toNode.width / 2, y: toNode.position.y + toNode.height / 2 };
  const midX = (P1.x + P4.x) / 2;
  const midY = (P1.y + P4.y) / 2;
  const d = `M ${P1.x} ${P1.y} L ${P4.x} ${P4.y}`;

  return (
    <g onMouseEnter={() => onHover(connectionId)} onMouseLeave={() => onHover(null)}>
      <path d={d} stroke={isHovered ? '#ef4444' : '#475569'} strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
      <path d={d} stroke="transparent" strokeWidth="15" fill="none" />
      {isHovered && (
        <foreignObject x={midX - 12} y={midY - 12} width="24" height="24">
          <button
            onClick={() => onDelete(connectionId)}
            className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
            title="Excluir Conexão"
          >
            &times;
          </button>
        </foreignObject>
      )}
    </g>
  );
};


const EditModal: React.FC<{
  node: BlockNode | null; onSave: (data: { text: string; type: VariableType }) => void; onClose: () => void;
}> = ({ node, onSave, onClose }) => {
  const [text, setText] = useState(node?.text || '');
  const [type, setType] = useState<VariableType>(node?.variableType || 'caractere');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(node?.text || '');
    setType(node?.variableType || 'caractere');
    if (node) { setTimeout(() => inputRef.current?.focus(), 0); }
  }, [node]);

  if (!node) return null;
  const handleSave = () => { onSave({ text, type }); onClose(); };
  const showTypeSelector = node.type === 'input' || node.type === 'process';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onMouseDown={onClose}>
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onMouseDown={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Editar Bloco</h2>
        <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo do Bloco</label>
        <input ref={inputRef} type="text" className="w-full border rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
        {showTypeSelector && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo da Variável</label>
            <select className="w-full border rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={type} onChange={(e) => setType(e.target.value as VariableType)}>
              <option value="inteiro">Inteiro</option>
              <option value="real">Real</option>
              <option value="caractere">Caractere</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 border rounded-md hover:bg-slate-100" onClick={onClose}>Cancelar</button>
          <button className="px-4 py-2 border rounded-md bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
};

const GenericCodeModal: React.FC<{ title: string; code: string; language: 'pascal' | 'cpp'; onClose: () => void; isPrismLoaded: boolean; }> = ({ title, code, language, onClose, isPrismLoaded }) => {
    const [copyText, setCopyText] = useState('Copiar');
    const highlightedCode = useMemo(() => {
        if (isPrismLoaded && window.Prism && window.Prism.languages[language]) {
            return window.Prism.highlight(code, window.Prism.languages[language], language);
        }
        return code; // Fallback to plain text
    }, [code, language, isPrismLoaded]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopyText('Copiado!');
            setTimeout(() => setCopyText('Copiar'), 2000);
        }).catch(err => {
            console.error('Falha ao copiar:', err);
            setCopyText('Erro!');
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold p-4 border-b">{title}</h2>
                <div className="p-4 bg-[#282c34] max-h-[60vh] overflow-y-auto">
                    <pre className="!bg-transparent !p-0 !m-0"><code className={`language-${language} text-sm`} dangerouslySetInnerHTML={{ __html: highlightedCode }} /></pre>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t">
                    <button className="px-4 py-2 border rounded-md hover:bg-slate-100" onClick={onClose}>Fechar</button>
                    <button className="px-4 py-2 border rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleCopy}>{copyText}</button>
                </div>
            </div>
        </div>
    );
};


const CodeModal: React.FC<{ code: string; onClose: () => void; onExplain: (code: string) => void; onGenerateTestTable: () => void; onConvertToCpp: (code: string) => void; isPrismLoaded: boolean; }> = ({ code, onClose, onExplain, onGenerateTestTable, onConvertToCpp, isPrismLoaded }) => {
  const [copyText, setCopyText] = useState('Copiar');

  useEffect(() => {
    if (isPrismLoaded && window.Prism) {
      window.Prism.highlightAll();
    }
  }, [code, isPrismLoaded]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopyText('Copiado!');
      setTimeout(() => setCopyText('Copiar'), 2000);
    }).catch(err => {
      console.error('Falha ao copiar texto: ', err);
      setCopyText('Erro ao copiar');
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold p-4 border-b">Código VisualG Gerado</h2>
        <div className="p-4 bg-[#282c34] max-h-[60vh] overflow-y-auto">
          <pre className="!bg-transparent !p-0 !m-0">
            <code className="language-pascal text-sm">{code}</code>
          </pre>
        </div>
        <div className="flex justify-between items-center gap-2 p-4 border-t">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onExplain(code)} className="px-3 py-2 border rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2 transition-colors"><Sparkles size={16} /> Explicar</button>
            <button onClick={onGenerateTestTable} className="px-3 py-2 border rounded-md bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-2 transition-colors"><Table size={16} /> Teste de Mesa</button>
            <button onClick={() => onConvertToCpp(code)} className="px-3 py-2 border rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-colors"><Code size={16} /> Converter C++</button>
          </div>
          <div>
            <button className="px-4 py-2 border rounded-md hover:bg-slate-100" onClick={onClose}>Fechar</button>
            <button className="px-4 py-2 border rounded-md bg-emerald-600 text-white hover:bg-emerald-700 ml-2" onClick={handleCopy}>{copyText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AiResponseModal: React.FC<{ title: string; content: string; onClose: () => void; isLoading: boolean; }> = ({ title, content, onClose, isLoading }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
    <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
      <h2 className="text-lg font-semibold p-4 border-b flex-shrink-0 flex items-center gap-2"><BrainCircuit size={20} /> {title}</h2>
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {isLoading ? (<div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>) : (<div className="prose prose-slate max-w-none"><ReactMarkdown>{content}</ReactMarkdown></div>)}
      </div>
      <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0"><button className="px-4 py-2 border rounded-md bg-indigo-600 text-white hover:bg-indigo-700" onClick={onClose}>Fechar</button></div>
    </div>
  </div>
);

const StatementModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (statement: string) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, onGenerate, isLoading }) => {
    const [statement, setStatement] = useState('');
    if (!isOpen) return null;

    const handleSubmit = () => {
        if (statement.trim()) {
            onGenerate(statement);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]" onClick={onClose}>
            <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BotMessageSquare size={20}/> Gerar Diagrama a partir de Enunciado</h2>
                <p className='text-sm text-slate-600 mb-3'>Descreva o problema que você quer resolver e a IA irá gerar o diagrama de blocos correspondente.</p>
                <textarea
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    placeholder="Ex: Crie um algoritmo que leia dois números, calcule a soma e mostre o resultado."
                    className="w-full h-40 border rounded-md p-3 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                    disabled={isLoading}
                />
                <div className="flex justify-end gap-2">
                    <button className="px-4 py-2 border rounded-md hover:bg-slate-100" onClick={onClose} disabled={isLoading}>Cancelar</button>
                    <button
                        className="px-4 py-2 border rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
                        onClick={handleSubmit}
                        disabled={isLoading || !statement.trim()}
                    >
                        {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        Gerar Diagrama
                    </button>
                </div>
            </div>
        </div>
    );
};


const TestTableModal: React.FC<{
  data: { headers: string[], rows: (string | null)[][] } | null;
  onClose: () => void;
  onExportPDF: () => void;
  isJspdfLoaded: boolean;
}> = ({ data, onClose, onExportPDF, isJspdfLoaded }) => {
  if (!data) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-4xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold p-4 border-b flex-shrink-0">Teste de Mesa</h2>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <table id="test-table" className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
              <tr>{data.headers.map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="bg-white border-b hover:bg-slate-50">
                  {row.map((cell, j) => <td key={j} className="px-4 py-2">{cell || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
          <button className="px-4 py-2 border rounded-md hover:bg-slate-100" onClick={onClose}>Fechar</button>
          <button onClick={onExportPDF} disabled={!isJspdfLoaded} className="px-4 py-2 border rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Exportar PDF</button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [nodes, setNodes] = useState<BlockNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingInfo, setDraggingInfo] = useState<{ id: string; offset: { x: number; y: number } } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [isHtml2ImageLoaded, setIsHtml2ImageLoaded] = useState(false);
  const [isJspdfLoaded, setIsJspdfLoaded] = useState(false);
  const [isPrismLoaded, setIsPrismLoaded] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedCppCode, setGeneratedCppCode] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<{ title: string, content: string } | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [algorithmName, setAlgorithmName] = useState('MeuAlgoritmo');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [testTableData, setTestTableData] = useState<{ headers: string[], rows: (string | null)[][] } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    setToasts((prev) => [...prev, { id: nanoid(5), message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const cssLinks = [
        'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css'
    ];
    cssLinks.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    });

    const scripts = [
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js', onload: () => setIsHtml2ImageLoaded(true) },
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', onload: null },
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', onload: () => setIsJspdfLoaded(true) },
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js', onload: null },
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js', onload: () => setIsPrismLoaded(true)},
    ];
    scripts.forEach(s => {
      const script = document.createElement('script');
      script.src = s.src;
      script.async = true;
      if (s.onload) script.onload = s.onload;
      document.body.appendChild(script);
    });

    return () => {
      cssLinks.forEach(href => { const el = document.querySelector(`link[href="${href}"]`); if (el) document.head.removeChild(el); });
      scripts.forEach(s => { const el = document.querySelector(`script[src="${s.src}"]`); if (el) document.body.removeChild(el); });
    };
}, []);


  const addNode = (type: SymbolType) => {
    const newNode: BlockNode = { id: nanoid(8), type, text: SYMBOL_CONFIG[type].label, position: { x: 100 - panOffset.x, y: 100 - panOffset.y }, width: 180, height: 80, variableType: type === 'input' ? 'caractere' : 'real' };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
    if (isSpacePressed) return; // Não arrastar blocos quando a tecla de espaço estiver pressionada
    e.preventDefault();
    const node = nodes.find(n => n.id === id);
    if (!node || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const offset = {
      x: (e.clientX / zoom) - node.position.x - (canvasRect.left / zoom),
      y: (e.clientY / zoom) - node.position.y - (canvasRect.top / zoom)
    };
    setDraggingInfo({ id, offset });
  }, [nodes, zoom, isSpacePressed]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && canvasRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset(prev => ({ x: prev.x + dx / zoom, y: prev.y + dy / zoom }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!draggingInfo || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    let newX = (e.clientX / zoom) - draggingInfo.offset.x - (canvasRect.left / zoom);
    let newY = (e.clientY / zoom) - draggingInfo.offset.y - (canvasRect.top / zoom);
    newX = Math.round(newX / 20) * 20;
    newY = Math.round(newY / 20) * 20;
    setNodes(prev => prev.map(n => n.id === draggingInfo.id ? { ...n, position: { x: newX, y: newY } } : n));
  }, [draggingInfo, zoom, isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setDraggingInfo(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSpacePressed && (e.target === canvasRef.current || (e.target as HTMLElement).parentElement === canvasRef.current)) {
      setSelectedNodeId(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleNodeSelect = (id: string) => {
    if (isConnectMode) {
      if (!connectFromId) { setConnectFromId(id); }
      else if (connectFromId !== id) {
        if (!connections.some(c => c.from === connectFromId && c.to === id)) {
          setConnections(prev => [...prev, { id: nanoid(), from: connectFromId, to: id }]);
        }
        setConnectFromId(null); setIsConnectMode(false);
      }
    } else { setSelectedNodeId(id); }
  };

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [selectedNodeId]);

  const deleteConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateNodeData = (data: { text: string; type: VariableType }) => {
    if (!editingNodeId) return;
    setNodes(prev => prev.map(n => n.id === editingNodeId ? { ...n, text: data.text, variableType: data.type } : n));
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === ' ' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            setIsSpacePressed(true);
        }
        if (e.key === 'Delete' && selectedNodeId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            deleteNode(selectedNodeId);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === ' ') {
            e.preventDefault();
            setIsSpacePressed(false);
            setIsPanning(false); // Garante que o pan pare ao soltar o espaço
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeId, deleteNode]);

  const exportToPNG = useCallback(() => {
    if (!isHtml2ImageLoaded || !canvasRef.current) return;
    window.htmlToImage.toPng(canvasRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 })
      .then((dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `${algorithmName}.png`;
        link.href = dataUrl;
        link.click();
      }).catch((err: unknown) => console.error(err));
  }, [isHtml2ImageLoaded, algorithmName]);

  const exportToJSON = () => {
    const data = JSON.stringify({ nodes, connections, algorithmName }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${algorithmName}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.nodes && data.connections) {
          setNodes(data.nodes);
          setConnections(data.connections);
          if (data.algorithmName) { setAlgorithmName(data.algorithmName); }
        }
      } catch { addToast('Arquivo JSON inválido.', 'error'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const clearCanvas = () => {
    if (window.confirm('Tem certeza? Isso limpará todo o diagrama.')) {
      setNodes([]); setConnections([]); setSelectedNodeId(null); setAlgorithmName("MeuAlgoritmo");
    }
  };

  const generateVisualGCode = (showModal = true) => {
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) {
      addToast("Erro: O fluxograma precisa ter um bloco 'Início'.", 'error');
      return null;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjMap = new Map<string, string>();
    connections.forEach(c => adjMap.set(c.from, c.to));

    const orderedNodes: BlockNode[] = [];
    let currentNode: BlockNode | undefined = startNode;
    const visited = new Set<string>();

    while (currentNode && !visited.has(currentNode.id)) {
      visited.add(currentNode.id);
      if (currentNode.type !== 'start' && currentNode.type !== 'end') {
        orderedNodes.push(currentNode);
      }
      const nextNodeId = adjMap.get(currentNode.id);
      currentNode = nextNodeId ? nodeMap.get(nextNodeId) : undefined;
    }

    const variables = new Map<string, string>();
    nodes.forEach(node => {
      if (node.type === 'input') {
        node.text.split(',').forEach(v => {
          const varName = v.trim();
          if (varName) {
            variables.set(varName, node.variableType || 'caractere');
          }
        });
      } else if (node.type === 'process') {
        const match = node.text.match(/^\s*([a-zA-Z0-9_]+)\s*<-/);
        if (match && match[1]) {
          const varName = match[1];
          if (!variables.has(varName)) {
            variables.set(varName, node.variableType || 'real');
          }
        }
      }
    });

    const mainCode = orderedNodes.map(node => {
      const { type, text } = node;
      switch (type) {
        case 'input':
          return `    leia(${text})`;
        case 'process':
          return `    ${text}`;
        case 'display':
          return `    escreval(${text})`;
        case 'write':
          return `    escreva(${text})`;
        default:
          return null;
      }
    }).filter(Boolean).join('\n') + '\n';

    let varBlock = '';
    if (variables.size > 0) {
      variables.forEach((type, name) => {
        varBlock += `    ${name}: ${type}\n`;
      });
    } else {
      varBlock = "    // Nenhuma variável declarada\n";
    }

    const finalCode = `algoritmo "${algorithmName || 'SemNome'}"\nvar\n${varBlock}inicio\n${mainCode}fimalgoritmo\n`;

    if (showModal) {
      setGeneratedCode(finalCode);
    }
    return finalCode;
  };

  const generateTestTableData = () => {
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) {
        addToast("Erro: Bloco 'Início' não encontrado.", 'error');
        return null;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjMap = new Map<string, string>();
    connections.forEach(c => adjMap.set(c.from, c.to));

    const orderedNodes: BlockNode[] = [];
    let currentNode: BlockNode | undefined = startNode;
    const visited = new Set<string>();

    while (currentNode && !visited.has(currentNode.id)) {
        visited.add(currentNode.id);
        if (currentNode.type !== 'start' && currentNode.type !== 'end') {
            orderedNodes.push(currentNode);
        }
        const nextNodeId = adjMap.get(currentNode.id);
        currentNode = nextNodeId ? nodeMap.get(nextNodeId) : undefined;
    }

    const allVars = new Set<string>();
    nodes.forEach(node => {
        if (node.type === 'input') {
            node.text.split(',').forEach(v => v.trim() && allVars.add(v.trim()));
        } else if (node.type === 'process') {
            const match = node.text.match(/^\s*(\w+)\s*<-/);
            if (match && match[1]) allVars.add(match[1]);
        }
    });

    const varList = Array.from(allVars);
    const headers = ['Passo', 'Linha', ...varList, 'Saída', 'Explicação'];
    const rows: (string | null)[][] = [];
    const varState: Record<string, string | null> = Object.fromEntries(varList.map(v => [v, null]));

    let step = 1;
    let line = 3 + varList.length;

    orderedNodes.forEach(node => {
        const { type, text } = node;
        const row = Array(headers.length).fill(null);
        row[0] = String(step);
        row[1] = String(line);

        varList.forEach((v, i) => { row[i + 2] = varState[v]; });

        switch (type) {
            case 'input':
                text.split(',').forEach(v => {
                    const trimmedVar = v.trim();
                    if (trimmedVar) {
                        varState[trimmedVar] = `[${trimmedVar}]`;
                        const varIndex = varList.indexOf(trimmedVar);
                        if (varIndex !== -1) row[varIndex + 2] = varState[trimmedVar];
                    }
                });
                row[row.length - 1] = `Lê entrada do utilizador para ${text}.`;
                break;
            case 'process':
                const match = text.match(/^\s*(\w+)\s*<-/);
                if (match && match[1]) {
                    const targetVar = match[1];
                    varState[targetVar] = text.split('<-')[1].trim();
                    const varIndex = varList.indexOf(targetVar);
                    if (varIndex !== -1) row[varIndex + 2] = varState[targetVar];
                }
                row[row.length - 1] = `Executa o processamento: ${text}.`;
                break;
            case 'display':
            case 'write':
                const command = type === 'display' ? 'escreval' : 'escreva';
                row[row.length - 2] = `{${text}}`;
                row[row.length - 1] = `Exibe o conteúdo de ${text} (${command}).`;
                break;
        }
        rows.push(row);
        step++;
        line++;
    });

    return { headers, rows };
  };


  const handleGenerateTestTable = () => {
    const data = generateTestTableData();
    if (data) {
        setTestTableData(data);
    }
  };

  const handleExportTestTablePDF = () => {
    if (!isJspdfLoaded) {
      addToast("A biblioteca de PDF ainda não carregou.", "warning");
      return;
    }
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(`Teste de Mesa: ${algorithmName}`, 14, 22);
    doc.autoTable({
      html: '#test-table',
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`${algorithmName}-teste-de-mesa.pdf`);
  };

  const handleGeminiCall = async (prompt: string, title?: string): Promise<string> => {
    if (title) {
        setIsLoadingAi(true);
        setAiResponse({ title, content: '' });
    }
    try {
        // ATENÇÃO: A chave de API está exposta no código do cliente.
        // Em um aplicativo real, essa chamada deve ser feita a partir de um backend para proteger a chave.
        const apiKey = "AIzaSyDQ85auZUEJu1EWFxFZL5xrlbX7MHu9mlE";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("API Error Response:", errorBody);
            throw new Error(`API Error: ${response.statusText}`);
        }
        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        if (title) {
            setAiResponse({ title, content: text });
        }
        return text;
    } catch (error) {
        console.error("Gemini API call failed:", error);
        const errorMessage = "Ocorreu um erro ao contatar a IA. Verifique o console para mais detalhes.";
        if (title) {
            setAiResponse({ title, content: errorMessage });
        }
        return `Error: ${errorMessage}`;
    } finally {
        if (title) {
            setIsLoadingAi(false);
        }
    }
};

  const handleExplainCode = (code: string) => {
    const prompt = `Explique o seguinte código VisualG para um programador iniciante, detalhando o que cada linha faz e qual o objetivo geral do algoritmo. Seja claro e didático, usando formatação Markdown.\n\n---\n\n${code}`;
    handleGeminiCall(prompt, "✨ Explicação do Código");
  };

  const handleConvertToCpp = async (code: string) => {
    const prompt = `Converta o seguinte código VisualG para C++. O estilo do código C++ deve ser muito simples, como se tivesse sido escrito por um programador iniciante. Siga estas regras estritamente:
1. Use apenas as bibliotecas básicas, como <iostream> e <string>.
2. Sempre inclua "using namespace std;" logo após os includes.
3. Declare todas as variáveis no início da função main().
4. Não use funções além da main(), classes, ponteiros ou sintaxe moderna de C++ (como "auto").
5. Forneça APENAS o código C++ puro, sem nenhum comentário, explicação ou formatação markdown.

---

VisualG:
${code}

---
C++:`;
    const cppCode = await handleGeminiCall(prompt);
    if (!cppCode.startsWith('Error:')) {
      setGeneratedCppCode(cppCode);
    } else {
        addToast("Falha ao converter o código para C++.", "error");
    }
  };

  const handleGenerateProblem = () => {
    const code = generateVisualGCode(false);
    if (!code) { return; }
    const prompt = `Crie um enunciado de problema simples do dia a dia que possa ser resolvido pelo seguinte algoritmo em VisualG. O enunciado deve ser claro, direto e usar formatação Markdown.\n\n---\n\n${code}`;
    handleGeminiCall(prompt, "✨ Problema Proposto");
  };

  const handleGenerateFromStatement = async (statement: string) => {
    setIsLoadingAi(true);
    const prompt = `
      Analise o seguinte enunciado de um problema de algoritmo e converta-o para uma estrutura JSON que representa um fluxograma.
      O JSON deve ter duas chaves principais: "nodes" e "connections".
      - "nodes" é um array de objetos, onde cada objeto tem: id (string nanoid(8)), type ('start'|'input'|'process'|'display'|'end'), text (string), position ({x, y}), width (180), height (80).
      - "connections" é um array de objetos, onde cada objeto tem: id (string nanoid()), from (id de um nó), to (id de outro nó).
      - Crie um fluxo lógico: Início -> Entradas -> Processamentos -> Saídas -> Fim.
      - Posicione os nós verticalmente com um espaçamento de 120px no eixo Y (position.y). O X pode ser fixo em 150.
      - Para o campo "text" dos nós de entrada, coloque apenas os nomes das variáveis (ex: "num1, num2").
      - Para o campo "text" dos nós de processo, coloque a expressão de atribuição (ex: "soma <- num1 + num2").
      - Para o campo "text" dos nós de saída ('display'), coloque o que deve ser exibido (ex: "'A soma é: ', soma").

      Responda APENAS com o código JSON puro, sem formatação markdown, comentários ou qualquer outro texto.

      Enunciado: "${statement}"
    `;
    const jsonResponse = await handleGeminiCall(prompt);
    setIsLoadingAi(false);

    // ADICIONE ESTA VERIFICAÇÃO AQUI
    if (jsonResponse.startsWith('Error:')) {
        addToast("A API do Gemini está indisponível. Tente novamente mais tarde.", "error");
        return; // Interrompe a execução para evitar o erro de JSON.parse
    }
    
    try {
        const cleanedResponse = jsonResponse.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanedResponse);
        if (data.nodes && data.connections) {
            setNodes(data.nodes);
            setConnections(data.connections);
            addToast("Diagrama gerado com sucesso!", "success");
            setIsStatementModalOpen(false);
        } else {
            throw new Error("JSON com formato inválido.");
        }
    } catch (error) {
        console.error("Erro ao processar a resposta da IA:", error);
        addToast("A IA retornou uma resposta inválida. Tente novamente.", "error");
    }
};

const handleGenerateSandraPDF = async () => {
    if (!isJspdfLoaded || !isHtml2ImageLoaded) {
        addToast("Componentes essenciais (PDF/Imagem) ainda não carregaram.", "warning");
        return;
    }
    
    addToast("Gerando PDF completo, por favor aguarde...", "info");

    try {
        // 1. Gerar Imagem do Diagrama
        const diagramImage = await window.htmlToImage.toPng(canvasRef.current!, { backgroundColor: '#ffffff', pixelRatio: 1.5 });

        // 2. Gerar Código VisualG (sem comentários)
        const visualgCodeRaw = generateVisualGCode(false);
        if (!visualgCodeRaw) {
            addToast("Não foi possível gerar o código VisualG.", "error");
            return;
        }
        const visualgCode = removeCodeComments(visualgCodeRaw, '//');

        // 3. Gerar Código C++ (sem comentários)
        const cppPrompt = `Converta o seguinte código VisualG para C++. O estilo do código C++ deve ser muito simples, como se tivesse sido escrito por um programador iniciante. Siga estas regras estritamente:
1. Use apenas as bibliotecas básicas, como <iostream> e <string>.
2. Sempre inclua "using namespace std;" logo após os includes.
3. Declare todas as variáveis no início da função main().
4. Não use funções além da main(), classes, ponteiros ou sintaxe moderna de C++ (como "auto").
5. Forneça APENAS o código C++ puro, sem nenhum comentário, explicação ou formatação markdown.

---

VisualG:
${visualgCodeRaw}

---
C++:`;
        const cppCodeRaw = await handleGeminiCall(cppPrompt);
        if (cppCodeRaw.startsWith('Error:')) {
            addToast("Falha ao gerar o código C++.", "error");
            return;
        }
        const cppCode = removeCodeComments(cppCodeRaw, '//');

        // 4. Gerar Teste de Mesa
        const tableData = generateTestTableData();
        if (!tableData) {
            addToast("Não foi possível gerar o teste de mesa.", "error");
            return;
        }

        // 5. Montar o PDF
        const doc = new window.jspdf.jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // --- Página de Rosto ---
        doc.setFontSize(22);
        doc.text("Atividade de Algoritmo", pageWidth / 2, 60, { align: 'center' });
        doc.setFontSize(16);
        doc.text(`Algoritmo: ${algorithmName}`, pageWidth / 2, 80, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 100, { align: 'center' });

        // --- Página do Diagrama de Blocos ---
        doc.addPage();
        doc.setFontSize(18);
        doc.text("1. Diagrama de Blocos", 14, 22);
        const imgProps = doc.getImageProperties(diagramImage);
        const aspect = imgProps.height / imgProps.width;
        const imgWidth = pageWidth - 28;
        const imgHeight = imgWidth * aspect;
        doc.addImage(diagramImage, 'PNG', 14, 30, imgWidth, imgHeight);

        // --- Página do Teste de Mesa ---
        doc.addPage('landscape');
        doc.setFontSize(18);
        doc.text("2. Teste de Mesa", 14, 22);
        doc.autoTable({ // <--- Correção aplicada
            head: [tableData.headers],
            body: tableData.rows,
            startY: 30,
            theme: 'grid',
        });
        
        // --- Página do Código VisualG ---
        doc.addPage('portrait');
        doc.setFontSize(18);
        doc.text("3. Código em VisualG", 14, 22);
        doc.setFont('Courier', 'normal');
        doc.setFontSize(10);
        doc.text(visualgCode, 14, 32);

        // --- Página do Código C++ ---
        doc.addPage();
        doc.setFontSize(18);
        doc.setFont('Helvetica', 'normal'); // Reset font
        doc.text("4. Código em C++", 14, 22);
        doc.setFont('Courier', 'normal');
        doc.setFontSize(10);
        doc.text(cppCode, 14, 32);
        
        doc.save(`Atividade_Sandra_${algorithmName}.pdf`);
        addToast("PDF da atividade gerado com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao gerar PDF da atividade:", error);
        addToast("Ocorreu um erro inesperado ao gerar o PDF.", "error");
    }
};

  const autoArrange = () => {
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) return;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjMap = new Map<string, string>();
    connections.forEach(c => adjMap.set(c.from, c.to));
    const sortedPath: BlockNode[] = [];
    let currentNode: BlockNode | undefined = startNode;
    const visited = new Set<string>();
    while (currentNode && !visited.has(currentNode.id)) {
      visited.add(currentNode.id);
      sortedPath.push(currentNode);
      const nextNodeId = adjMap.get(currentNode.id);
      currentNode = nextNodeId ? nodeMap.get(nextNodeId) : undefined;
    }
    const initialX = 150; const initialY = 50; const spacingY = 120;
    const newNodes = nodes.map(node => {
      const sortedIndex = sortedPath.findIndex(n => n.id === node.id);
      if (sortedIndex !== -1) { return { ...node, position: { x: initialX, y: initialY + sortedIndex * spacingY } }; }
      return { ...node, position: { x: node.position.x + Math.random() * 20, y: node.position.y + Math.random() * 20 } };
    });
    setNodes(newNodes);
  };

  const arrows = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return connections.map(conn => ({ id: conn.id, fromNode: nodeMap.get(conn.from), toNode: nodeMap.get(conn.to) })).filter(arrow => arrow.fromNode && arrow.toNode);
  }, [nodes, connections]);

  return (
    <div className="bg-slate-200 font-sans flex flex-col h-screen overflow-hidden">
      <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm space-y-2">
        {toasts.map((toast) => (<ToastNotification key={toast.id} toast={toast} onDismiss={removeToast} />))}
      </div>
      
      {editingNodeId && <EditModal node={nodes.find(n => n.id === editingNodeId) || null} onSave={updateNodeData} onClose={() => setEditingNodeId(null)} />}
      {generatedCode && <CodeModal code={generatedCode} onClose={() => setGeneratedCode(null)} onExplain={handleExplainCode} onGenerateTestTable={handleGenerateTestTable} onConvertToCpp={handleConvertToCpp} isPrismLoaded={isPrismLoaded} />}
      {generatedCppCode && <GenericCodeModal title="Código C++ Convertido" code={generatedCppCode} language="cpp" onClose={() => setGeneratedCppCode(null)} isPrismLoaded={isPrismLoaded} />}
      {aiResponse && <AiResponseModal title={aiResponse.title} content={aiResponse.content} isLoading={isLoadingAi} onClose={() => setAiResponse(null)} />}
      {testTableData && <TestTableModal data={testTableData} onClose={() => setTestTableData(null)} onExportPDF={handleExportTestTablePDF} isJspdfLoaded={isJspdfLoaded} />}
      <StatementModal isOpen={isStatementModalOpen} onClose={() => setIsStatementModalOpen(false)} onGenerate={handleGenerateFromStatement} isLoading={isLoadingAi} />

      <header className="bg-slate-800 text-white p-2 shadow-lg flex justify-between items-center z-40 flex-shrink-0 gap-4 h-16">
        <div className="flex items-center gap-3 h-full">
          <span className="text-xl font-bold">FluxoGenius</span>
          <input type="text" value={algorithmName} onChange={(e) => setAlgorithmName(e.target.value)} placeholder="Nome do Algoritmo" className="text-lg md:text-xl font-bold p-2 bg-transparent text-white rounded-md outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-slate-700 transition-all w-full max-w-xs md:max-w-md" aria-label="Nome do Algoritmo" />
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button onClick={() => setIsStatementModalOpen(true)} className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2"><BrainCircuit size={18} /> Gerar via Enunciado</button>
          <button onClick={handleGenerateProblem} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2"><Sparkles size={18} /> Gerar Problema</button>
          <button onClick={() => generateVisualGCode()} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2"><Code size={18} /> Gerar Código</button>
          <a href="https://fluxogenius.vercel.app" target="_blank" rel="noopener noreferrer" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2"><Link size={18} /> Criador</a>
        </div>
      </header>

      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-64 bg-slate-100 p-3 shadow-md overflow-y-auto flex-shrink-0">
          <h2 className="text-md font-semibold mb-3 text-slate-700">Blocos</h2>
          <div className="space-y-2">{Object.entries(SYMBOL_CONFIG).map(([type, { label }]) => (<button key={type} onClick={() => addNode(type as SymbolType)} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center gap-2 transition-colors text-left"><Plus size={16} /> {label}</button>))}</div>
          <div className="mt-4 border-t pt-3">
            <h2 className="text-md font-semibold mb-3 text-slate-700">Ações</h2>
            <div className="space-y-2">
              <button onClick={() => setIsConnectMode(c => !c)} className={`w-full p-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${isConnectMode ? 'bg-amber-400 text-amber-900' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}><MousePointer2 size={16} /> {isConnectMode ? 'Conectando...' : 'Conectar Blocos'}</button>
              <button onClick={autoArrange} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors"><GitCommitVertical size={16} /> Reorganizar Fluxo</button>
              <button onClick={handleGenerateSandraPDF} className="w-full bg-pink-600 hover:bg-pink-700 text-white p-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"><FileText size={16} /> Gerar Atividade (PDF)</button>
              <button onClick={exportToPNG} disabled={!isHtml2ImageLoaded} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileImage size={16} /> Exportar PNG</button>
              <button onClick={exportToJSON} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors"><Download size={16} /> Salvar JSON</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors"><Upload size={16} /> Carregar JSON</button>
              <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={importFromJSON} />
              <button onClick={clearCanvas} className="w-full bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"><Trash2 size={16} /> Limpar Tudo</button>
            </div>
          </div>
        </aside>

        <main className={`flex-grow bg-slate-50 relative overflow-hidden border-2 border-slate-300 m-2 rounded-lg ${isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`} onMouseDown={handleCanvasMouseDown}>
          <div
            ref={canvasRef}
            className={`relative w-full h-full transition-transform duration-200 ${showGrid ? "bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:20px_20px]" : ""}`}
            style={{ transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`, transformOrigin: "0 0" }}
          >
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
              <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" /></marker></defs>
              <g className="pointer-events-auto">
                {arrows.map(arrow => arrow.fromNode && arrow.toNode && <Arrow key={arrow.id} connectionId={arrow.id} fromNode={arrow.fromNode} toNode={arrow.toNode} isHovered={hoveredConnectionId === arrow.id} onDelete={deleteConnection} onHover={setHoveredConnectionId} />)}
              </g>
            </svg>
            {nodes.map(node => (<NodeComponent key={node.id} node={node} isSelected={selectedNodeId === node.id || connectFromId === node.id} onSelect={handleNodeSelect} onDragStart={handleDragStart} onDoubleClick={setEditingNodeId} onDelete={deleteNode} />))}
          </div>
          <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-lg flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-2 rounded hover:bg-slate-200"><ZoomOut size={18} /></button>
            <span className="font-semibold text-slate-700 text-sm w-12 text-center" onClick={() => setZoom(1)}>{(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 rounded hover:bg-slate-200"><ZoomIn size={18} /></button>
            <div className="w-px h-6 bg-slate-300 mx-1"></div>
            <button onClick={() => setShowGrid(g => !g)} className={`p-2 rounded ${showGrid ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-200'}`}><Grid size={18} /></button>
          </div>
        </main>
      </div>
    </div>
  );
}
