"use client";
import React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
// No início do arquivo
import { Code, Link, Trash2, Plus, ZoomIn, ZoomOut, Grid, Download, Upload, FileImage, GitCommitVertical, Sparkles, BrainCircuit, AlertTriangle, X } from 'lucide-react';
// A biblioteca html-to-image será carregada dinamicamente via tag <script>
import { nanoid } from 'nanoid';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image'; // <-- ADICIONE ESTA LINHA


// --- DEFINIÇÕES DE TIPO (TYPESCRIPT) ---
type SymbolType = 'start' | 'end' | 'input' | 'process' | 'display';
type VariableType = 'real' | 'inteiro' | 'caractere';

// Adiciona a propriedade htmlToImage ao objeto global Window para o TypeScript
declare global {
  interface Window {
    htmlToImage: {
      toPng: (element: HTMLElement, options?: any) => Promise<string>;
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
  input: { label: 'Entrada', shape: 'parallelogram' },
  process: { label: 'Processo', shape: 'rectangle' },
  display: { label: 'Exibição', shape: 'display' },
};

// --- COMPONENTES AUXILIARES ---

// --- NOVO: DEFINIÇÃO DE TIPO PARA A NOTIFICAÇÃO ---
type Toast = {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
};

// --- NOVO: COMPONENTE DE NOTIFICAÇÃO (TOAST) ---
const ToastNotification: React.FC<{
  toast: Toast;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  const theme = {
    error: {
      icon: <AlertTriangle className="text-red-500" size={20} />,
      barColor: 'bg-red-500',
    },
    warning: {
      // Adicione outros tipos se precisar
      icon: <AlertTriangle className="text-yellow-500" size={20} />,
      barColor: 'bg-yellow-500',
    },
    info: {
      // Adicione outros tipos se precisar
      icon: <AlertTriangle className="text-blue-500" size={20} />,
      barColor: 'bg-blue-500',
    }
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300); // Espera a animação de saída terminar
  };

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 5000); // A notificação some após 5 segundos
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`
        flex items-start w-full max-w-sm bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden
        transition-all duration-300 transform
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      <div className={`w-1.5 h-full ${theme[toast.type].barColor}`} />
      <div className="flex items-center p-3 gap-3">
        <div className="flex-shrink-0">
          {theme[toast.type].icon}
        </div>
        <p className="text-sm font-medium text-slate-800">
          {toast.message}
        </p>
      </div>
      <button onClick={handleDismiss} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded-full m-1">
        <X size={16} />
      </button>
    </div>
  );
};

const NodeComponent: React.FC<{
  node: BlockNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ node, isSelected, onSelect, onDragStart, onDoubleClick, onDelete }) => {
  const getSymbolShapeStyle = () => {
    const config = SYMBOL_CONFIG[node.type];
    switch (config.shape) {
      case 'parallelogram': return { clipPath: 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)' };
      case 'display': return { clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%)' };
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

const Arrow: React.FC<{ fromNode: BlockNode; toNode: BlockNode }> = ({ fromNode, toNode }) => {
  const P1 = { x: fromNode.position.x + fromNode.width / 2, y: fromNode.position.y + fromNode.height / 2 };
  const P4 = { x: toNode.position.x + toNode.width / 2, y: toNode.position.y + toNode.height / 2 };
  const P2 = { x: P1.x, y: (P1.y + P4.y) / 2 };
  const P3 = { x: P4.x, y: (P1.y + P4.y) / 2 };
  const d = `M ${P1.x} ${P1.y} C ${P2.x} ${P2.y}, ${P3.x} ${P3.y}, ${P4.x} ${P4.y}`;
  return <path d={d} stroke="#475569" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />;
};

const EditModal: React.FC<{
  node: BlockNode | null;
  onSave: (data: { text: string; type: VariableType }) => void;
  onClose: () => void;
}> = ({ node, onSave, onClose }) => {
  const [text, setText] = useState(node?.text || '');
  const [type, setType] = useState<VariableType>(node?.variableType || 'caractere');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(node?.text || '');
    setType(node?.variableType || 'caractere');
    if (node) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    onSave({ text, type });
    onClose();
  };

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


const CodeModal: React.FC<{ code: string; onClose: () => void; onExplain: (code: string) => void; }> = ({ code, onClose, onExplain }) => {
  const [copyText, setCopyText] = useState('Copiar');
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopyText('Copiado!'); setTimeout(() => setCopyText('Copiar'), 2000); };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold p-4 border-b">Código VisualG Gerado</h2>
        <pre className="p-4 bg-slate-900 text-white text-sm overflow-x-auto"><code>{code}</code></pre>
        <div className="flex justify-between items-center gap-2 p-4 border-t">
          <button onClick={() => onExplain(code)} className="px-4 py-2 border rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2 transition-colors"><Sparkles size={16} /> ✨ Explicar Código</button>
          <div>
            <button className="px-4 py-2 border rounded-md hover:bg-slate-100" onClick={onClose}>Fechar</button>
            <button className="px-4 py-2 border rounded-md bg-emerald-600 text-white hover:bg-emerald-700 ml-2" onClick={handleCopy}>{copyText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AiResponseModal: React.FC<{ title: string; content: string; onClose: () => void; isLoading: boolean; }> = ({ title, content, onClose, isLoading }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold p-4 border-b flex-shrink-0 flex items-center gap-2">
          <BrainCircuit size={20} /> {title}
        </h2>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none">
              <ReactMarkdown>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
          <button className="px-4 py-2 border rounded-md bg-indigo-600 text-white hover:bg-indigo-700" onClick={onClose}>
            Fechar
          </button>
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
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<{ title: string, content: string } | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // NOVO ESTADO: Armazena o nome do algoritmo
  const [algorithmName, setAlgorithmName] = useState('MeuAlgoritmo');

  // NOVO ESTADO: Para gerenciar as notificações
  const [toasts, setToasts] = useState<Toast[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // NOVA FUNÇÃO: Adiciona uma notificação à lista
  const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const newToast: Toast = {
      id: nanoid(5),
      message,
      type,
    };
    setToasts((prevToasts) => [...prevToasts, newToast]);
  }, []);

  // NOVA FUNÇÃO: Remove uma notificação da lista
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => console.error('Falha ao carregar o script html-to-image.');
    document.head.appendChild(script);
    return () => {
      const scriptTags = document.head.getElementsByTagName('script');
      for (let i = 0; i < scriptTags.length; i++) {
        if (scriptTags[i].src === script.src) { document.head.removeChild(scriptTags[i]); }
      }
    };
  }, []);

  const addNode = (type: SymbolType) => {
    const newNode: BlockNode = {
      id: nanoid(8),
      type,
      text: SYMBOL_CONFIG[type].label,
      position: { x: 100, y: 100 },
      width: 180,
      height: 80,
      variableType: type === 'input' ? 'caractere' : 'real'
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === id);
    if (!node || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const offset = { x: (e.clientX / zoom) - node.position.x - (canvasRect.left / zoom), y: (e.clientY / zoom) - node.position.y - (canvasRect.top / zoom) };
    setDraggingInfo({ id, offset });
  }, [nodes, zoom]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingInfo || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    let newX = (e.clientX / zoom) - draggingInfo.offset.x - (canvasRect.left / zoom);
    let newY = (e.clientY / zoom) - draggingInfo.offset.y - (canvasRect.top / zoom);
    newX = Math.round(newX / 20) * 20; newY = Math.round(newY / 20) * 20;
    setNodes(prev => prev.map(n => n.id === draggingInfo.id ? { ...n, position: { x: newX, y: newY } } : n));
  }, [draggingInfo, zoom]);

  const handleMouseUp = useCallback(() => { setDraggingInfo(null); }, []);

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

  const updateNodeData = (data: { text: string; type: VariableType }) => {
    if (!editingNodeId) return;
    setNodes(prev =>
      prev.map(n =>
        n.id === editingNodeId
          ? { ...n, text: data.text, variableType: data.type }
          : n
      )
    );
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
      if (e.key === 'Delete' && selectedNodeId) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        deleteNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, deleteNode]);

  const exportToPNG = useCallback(() => {
    if (!isScriptLoaded || !canvasRef.current) return;
    window.htmlToImage.toPng(canvasRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 })
      .then((dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `${algorithmName}.png`;
        link.href = dataUrl;
        link.click();
      }).catch((err: unknown) => console.error(err));
  }, [isScriptLoaded, algorithmName]);

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
          if (data.algorithmName) {
            setAlgorithmName(data.algorithmName);
          }
        }
      } catch (error) { addToast('Arquivo JSON inválido.', 'error'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const clearCanvas = () => {
    if (window.confirm('Tem certeza? Isso limpará todo o diagrama.')) {
      setNodes([]);
      setConnections([]);
      setSelectedNodeId(null);
      setAlgorithmName("MeuAlgoritmo");
    }
  };

  // --- FUNÇÃO DE GERAÇÃO DE CÓDIGO MELHORADA ---
  const generateVisualGCode = (showModal = true) => {
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) {
      const errorMsg = "Erro: Bloco 'Início' não encontrado.";
      // A função agora só mostra o toast, não abre mais um modal
      if (showModal) addToast(errorMsg, 'error');
      return errorMsg;
    }

    // MODIFICADO: Usa o nome do algoritmo do estado
    let code = `algoritmo "${algorithmName || 'SemNome'}"\n`;

    const variables = new Set<string>();
    let mainCode = "";
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjMap = new Map<string, string>();
    connections.forEach(c => adjMap.set(c.from, c.to));
    let currentNode: BlockNode | undefined = startNode;
    const visited = new Set<string>();

    while (currentNode && !visited.has(currentNode.id)) {
      visited.add(currentNode.id);
      const { type, text, variableType } = currentNode;

      switch (type) {
        case 'input':
          mainCode += `   leia(${text})\n`;
          // MELHORADO: Processa múltiplas variáveis (ex: n1, n2)
          text.split(',').forEach(v => {
            const trimmedVar = v.trim();
            if (trimmedVar) {
              variables.add(`${trimmedVar}: ${variableType || 'caractere'}`);
            }
          });
          break;
        case 'process':
          mainCode += `   ${text}\n`;
          // CORRIGIDO: Adiciona a variável da atribuição (ex: resultado <- n1 + n2)
          const match = text.match(/^\s*(\w+)\s*<-/);
          if (match && match[1]) {
            variables.add(`${match[1]}: ${variableType || 'real'}`);
          }
          break;
        case 'display':
          mainCode += `   escreval(${text})\n`;
          break;
      }
      const nextNodeId = adjMap.get(currentNode.id);
      currentNode = nextNodeId ? nodeMap.get(nextNodeId) : undefined;
    }

    code += "var\n";
    if (variables.size > 0) {
      variables.forEach(v => { code += `   ${v}\n`; });
    } else {
      code += "   // Nenhuma variável declarada\n";
    }
    code += "inicio\n" + mainCode + "fimalgoritmo\n";

    if (showModal) setGeneratedCode(code);
    return code;
  };


  const handleGeminiCall = async (prompt: string, title: string) => {
    setIsLoadingAi(true);
    setAiResponse({ title, content: '' });

    try {
      const apiKey = "AIzaSyDVmFt4Gb4fmwQxa36GITx7YMVvatQCnww"; // Deixe em branco se usar proxy ou variável de ambiente
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }] }] };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("API Error Response:", errorBody);
        throw new Error(`API Error: ${response.statusText}`);
      }

      const result = await response.json();
      const text = result.candidates[0].content.parts[0].text;
      setAiResponse({ title, content: text });
    } catch (error) {
      console.error("Gemini API call failed:", error);
      setAiResponse({ title, content: "Ocorreu um erro ao contatar a IA. Verifique o console para mais detalhes." });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleExplainCode = (code: string) => {
    const prompt = `Explique o seguinte código VisualG para um programador iniciante, detalhando o que cada linha faz e qual o objetivo geral do algoritmo. Seja claro e didático, usando formatação Markdown.\n\n---\n\n${code}`;
    handleGeminiCall(prompt, "✨ Explicação do Código");
  };

  const handleGenerateProblem = () => {
    const code = generateVisualGCode(false);
    if (code.startsWith("Erro")) {
      addToast(code, 'error');
      return;
    }
    const prompt = `Crie um enunciado de problema simples do dia a dia que possa ser resolvido pelo seguinte algoritmo em VisualG. O enunciado deve ser claro, direto e usar formatação Markdown.\n\n---\n\n${code}`;
    handleGeminiCall(prompt, "✨ Problema Proposto");
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
      // Posiciona nós órfãos para não ficarem empilhados
      return { ...node, position: { x: node.position.x + 50, y: node.position.y + 50 } };
    });
    setNodes(newNodes);
  };

  const arrows = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return connections.map(conn => ({ id: conn.id, fromNode: nodeMap.get(conn.from), toNode: nodeMap.get(conn.to) })).filter(arrow => arrow.fromNode && arrow.toNode);
  }, [nodes, connections]);

  return (
    <div className="bg-slate-200 font-sans flex flex-col h-screen overflow-hidden">
      {/* --- NOVO: CONTÊINER DE NOTIFICAÇÕES --- */}
      <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm space-y-2">
        {toasts.map((toast) => (
          <ToastNotification key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
      {editingNodeId && <EditModal node={nodes.find(n => n.id === editingNodeId) || null} onSave={updateNodeData} onClose={() => setEditingNodeId(null)} />}
      {generatedCode && <CodeModal code={generatedCode} onClose={() => setGeneratedCode(null)} onExplain={handleExplainCode} />}
      {aiResponse && <AiResponseModal title={aiResponse.title} content={aiResponse.content} isLoading={isLoadingAi} onClose={() => setAiResponse(null)} />}

      {/* MODIFICADO: Header com input para o nome do algoritmo */}
      <header className="bg-slate-800 text-white p-2 shadow-lg flex justify-between items-center z-40 flex-shrink-0 gap-4 h-16">
        <Image
          src="/images/letras.png" // O caminho começa com / e aponta para o arquivo na pasta public
          alt="Logo do Projeto"
          width={150}             // Largura real da imagem em pixels
          height={100}            // Altura real da imagem em pixels
          className="rounded-full" // Exemplo de classe para estilizar
        />
        <input
          type="text"
          value={algorithmName}
          onChange={(e) => setAlgorithmName(e.target.value)}
          placeholder="Nome do Algoritmo"
          className="text-lg md:text-xl font-bold p-2 bg-transparent text-white rounded-md outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-slate-700 transition-all w-full max-w-xs md:max-w-md"
          aria-label="Nome do Algoritmo"
        />
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button onClick={handleGenerateProblem} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2">
            <Sparkles size={18} /> Gerar Problema
          </button>
          <button onClick={() => generateVisualGCode()} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2">
            <Code size={18} /> Gerar Código
          </button>
          <a href="https://luizeduos.web.app" target="_blank" rel="noopener noreferrer" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2">
            <Link size={18} /> Criador
          </a>
        </div>
      </header>

      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-64 bg-slate-100 p-3 shadow-md overflow-y-auto flex-shrink-0">
          <h2 className="text-md font-semibold mb-3 text-slate-700">Blocos</h2>
          <div className="space-y-2">
            {Object.entries(SYMBOL_CONFIG).map(([type, { label }]) => (<button key={type} onClick={() => addNode(type as SymbolType)} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center gap-2 transition-colors"><Plus size={16} /> {label}</button>))}
          </div>
          <div className="mt-4 border-t pt-3">
            <h2 className="text-md font-semibold mb-3 text-slate-700">Ações</h2>
            <div className="space-y-2">
              <button onClick={() => setIsConnectMode(c => !c)} className={`w-full p-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${isConnectMode ? 'bg-amber-400 text-amber-900' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>Conectar Blocos</button>
              <button onClick={autoArrange} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors"><GitCommitVertical size={16} /> Reorganizar Fluxo</button>
              <button onClick={exportToPNG} disabled={!isScriptLoaded} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileImage size={16} /> Exportar PNG</button>
              <button onClick={exportToJSON} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors"><Download size={16} /> Salvar JSON</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-200 hover:bg-slate-300 p-2 rounded-lg text-slate-700 font-medium flex items-center justify-center gap-2 transition-colors"><Upload size={16} /> Carregar JSON</button>
              <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={importFromJSON} />
              <button onClick={clearCanvas} className="w-full bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"><Trash2 size={16} /> Limpar Tudo</button>
            </div>
          </div>
        </aside>

        <main className="flex-grow bg-slate-50 relative overflow-hidden border-2 border-slate-300 m-2 rounded-lg">
          <div ref={canvasRef} className={`relative w-full h-full transition-transform duration-200 ${showGrid ? "bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:20px_20px]" : ""}`} style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} onMouseDown={() => setSelectedNodeId(null)}>
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{ overflow: "visible" }}>
              <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" /></marker></defs>
              {arrows.map(arrow => arrow.fromNode && arrow.toNode && <Arrow key={arrow.id} fromNode={arrow.fromNode} toNode={arrow.toNode} />)}
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