/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {GoogleGenAI, Modality} from '@google/genai';
import {
  ChevronDown,
  Circle,
  Download,
  Eraser,
  History,
  LoaderCircle,
  Minus,
  Pencil,
  Redo,
  SendHorizontal,
  Square,
  Trash2,
  Undo,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    const e = m[1];
    const err = JSON.parse(e);
    return err.message || error;
  } catch (e) {
    return error;
  }
}

const ToolButton = ({icon, label, active, ...props}) => (
  <button
    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-150 ease-in-out transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
      active
        ? 'bg-blue-500 text-white shadow-md'
        : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
    }`}
    aria-label={label}
    aria-pressed={active}
    title={label}
    {...props}>
    {icon}
  </button>
);

const PromptHistoryModal = ({history, onRestore, onClose}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-700 font-mega">Prompt History</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="overflow-y-auto flex-grow pr-2">
        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No history yet. Generate an image to see it here.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item, index) => (
              <div key={index} className="border rounded-lg p-3 flex flex-col gap-2 bg-gray-50">
                <img src={item.image} alt={item.prompt} className="rounded-md border aspect-video object-contain" />
                <p className="text-xs text-gray-600 font-mono flex-grow">"{item.prompt}"</p>
                <button onClick={() => onRestore(item.image)} className="w-full bg-blue-500 text-white text-sm py-1.5 rounded-md hover:bg-blue-600 transition-colors">
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default function Home() {
  const canvasRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    'gemini-2.5-flash-image-preview',
  );

  const [tool, setTool] = useState('pencil');
  const [penSize, setPenSize] = useState(5);
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const startPosRef = useRef<{x: number; y: number} | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  // State for prompt history
  const [promptHistory, setPromptHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const saveInitialCanvasState = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const initialState = canvas.toDataURL('image/png');
    setCanvasHistory([initialState]);
    setHistoryIndex(0);
  }, []);

  const saveCanvasState = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(dataUrl);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [canvasHistory, historyIndex]);

  const restoreCanvasState = (index: number) => {
    if (index < 0 || index >= canvasHistory.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = canvasHistory[index];
    setHistoryIndex(index);
  };

  const undo = () => (historyIndex > 0) && restoreCanvasState(historyIndex - 1);
  const redo = () => (historyIndex < canvasHistory.length - 1) && restoreCanvasState(historyIndex + 1);

  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
        saveInitialCanvasState();
      };
      img.src = generatedImage;
    }
  }, [generatedImage, saveInitialCanvasState]);

  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas();
      saveInitialCanvasState();
    }
  }, [saveInitialCanvasState]);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches ? e.touches[0] : null;
    return {
      x: ((e.nativeEvent.offsetX || (touch && touch.clientX - rect.left)) * scaleX),
      y: ((e.nativeEvent.offsetY || (touch && touch.clientY - rect.top)) * scaleY),
    };
  };

  const startDrawing = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    setIsDrawing(true);
    startPosRef.current = {x, y};
    ctx.beginPath();
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.moveTo(x, y);
    } else {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.type === 'touchmove') e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);
    
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : penColor;

    if (['line', 'rectangle', 'circle'].includes(tool)) {
      ctx.putImageData(snapshotRef.current, 0, 0);
    }
    
    switch (tool) {
      case 'pencil': case 'eraser': ctx.lineTo(x, y); ctx.stroke(); break;
      case 'line':
        ctx.beginPath(); ctx.moveTo(startPosRef.current.x, startPosRef.current.y); ctx.lineTo(x, y); ctx.stroke();
        break;
      case 'rectangle':
        ctx.beginPath(); ctx.strokeRect(startPosRef.current.x, startPosRef.current.y, x - startPosRef.current.x, y - startPosRef.current.y);
        break;
      case 'circle':
        const start = startPosRef.current; const centerX = start.x + (x - start.x) / 2; const centerY = start.y + (y - start.y) / 2;
        const radiusX = Math.abs((x - start.x) / 2); const radiusY = Math.abs((y - start.y) / 2);
        ctx.beginPath(); ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI); ctx.stroke();
        break;
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    setIsDrawing(false);
    ctx.closePath();
    saveCanvasState();
  };

  const clearCanvas = () => {
    setGeneratedImage(null);
    backgroundImageRef.current = null;
    initializeCanvas();
    saveInitialCanvasState();
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'gemini-co-drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleRestoreFromHistory = (image) => {
    setGeneratedImage(image);
    setShowHistoryModal(false);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canvasRef.current || isLoading) return;
    setIsLoading(true);

    try {
      const canvas = canvasRef.current;
      const drawingData = canvas.toDataURL('image/png').split(',')[1];
      
      const contents = {
        parts: [
          {inlineData: {data: drawingData, mimeType: 'image/png'}},
          {text: `${prompt}. Keep the same minimal line drawing style.`},
        ],
      };

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {responseModalities: [Modality.TEXT, Modality.IMAGE]},
      });

      const data = {success: true, imageData: null, error: undefined};
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) data.imageData = part.inlineData.data;
      }

      if (data.imageData) {
        const fullImageData = `data:image/png;base64,${data.imageData}`;
        setGeneratedImage(fullImageData);
        setPromptHistory(prev => [...prev, { prompt, image: fullImageData }]);
        setPrompt('');
      } else {
        throw new Error('Failed to generate image, please try again.');
      }
    } catch (error) {
      console.error('Error submitting drawing:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen notebook-paper-bg text-gray-900 flex flex-col justify-start items-center">
        <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-5xl w-full">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-4 gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-0 leading-tight font-mega">Gemini Co-Drawing</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">
                Built with{' '}
                <a className="underline" href="https://ai.google.dev/gemini-api/docs/image-generation" target="_blank" rel="noopener noreferrer">Gemini native image generation</a>
              </p>
            </div>
            <div className="relative">
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="h-10 rounded-full bg-white pl-3 pr-8 text-sm text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 appearance-none border-2 border-white" aria-label="Select Gemini Model">
                <option value="gemini-2.5-flash-image-preview">2.5 Flash</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Drawing Toolbar */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-4 p-2 bg-gray-200/80 rounded-full shadow-md">
            <div className="flex items-center gap-1 sm:gap-2 p-1 bg-gray-100 rounded-full">
              <ToolButton icon={<Pencil className="w-5 h-5" />} label="Pencil" active={tool === 'pencil'} onClick={() => setTool('pencil')} />
              <ToolButton icon={<Eraser className="w-5 h-5" />} label="Eraser" active={tool === 'eraser'} onClick={() => setTool('eraser')} />
              <ToolButton icon={<Minus className="w-5 h-5" />} label="Line" active={tool === 'line'} onClick={() => setTool('line')} />
              <ToolButton icon={<Square className="w-5 h-5" />} label="Rectangle" active={tool === 'rectangle'} onClick={() => setTool('rectangle')} />
              <ToolButton icon={<Circle className="w-5 h-5" />} label="Circle" active={tool === 'circle'} onClick={() => setTool('circle')} />
            </div>
            
            <div className="w-px h-8 bg-gray-300 hidden sm:block"></div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative w-9 h-9 sm:w-10 sm:h-10">
                <button type="button" className="w-full h-full rounded-full overflow-hidden border-2 border-white shadow-sm transition-transform hover:scale-110" onClick={() => colorInputRef.current.click()} aria-label="Open color picker" style={{backgroundColor: penColor}} />
                <input ref={colorInputRef} type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} className="opacity-0 absolute w-px h-px" aria-label="Select pen color" />
              </div>
              <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm">
                <Pencil className="w-4 h-4 text-gray-500" />
                <input id="pen-size" type="range" min="1" max="50" value={penSize} onChange={(e) => setPenSize(parseInt(e.target.value, 10))} className="w-20 sm:w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                <span className="text-sm font-mono w-8 text-right text-gray-600">{penSize}px</span>
              </div>
            </div>

            <div className="w-px h-8 bg-gray-300 hidden sm:block"></div>

            <div className="flex items-center gap-1 sm:gap-2 p-1 bg-gray-100 rounded-full">
              <ToolButton icon={<Undo className="w-5 h-5" />} label="Undo" onClick={undo} disabled={historyIndex <= 0} active={false} />
              <ToolButton icon={<Redo className="w-5 h-5" />} label="Redo" onClick={redo} disabled={historyIndex >= canvasHistory.length - 1} active={false} />
              <ToolButton icon={<History className="w-5 h-5" />} label="Prompt History" onClick={() => setShowHistoryModal(true)} active={false} />
              <ToolButton icon={<Download className="w-5 h-5" />} label="Save Drawing" onClick={saveDrawing} active={false} />
              <ToolButton icon={<Trash2 className="w-5 h-5" />} label="Clear Canvas" onClick={clearCanvas} active={false} />
            </div>
          </div>

          <div className="w-full mb-6">
            <canvas
              ref={canvasRef} width={960} height={540}
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
              className="border-2 border-black w-full sm:h-[60vh] h-[30vh] min-h-[320px] bg-white/90 touch-none hover:cursor-crosshair"
            />
          </div>

          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Add your change..." className="w-full p-3 sm:p-4 pr-12 sm:pr-14 text-sm sm:text-base border-2 border-black bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all font-mono" required />
              <button type="submit" disabled={isLoading} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-none bg-black text-white hover:cursor-pointer hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {isLoading ? <LoaderCircle className="w-5 sm:w-6 h-5 sm:h-6 animate-spin" aria-label="Loading" /> : <SendHorizontal className="w-5 sm:w-6 h-5 sm:h-6" aria-label="Submit" />}
              </button>
            </div>
          </form>
        </main>
        {showErrorModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-700">Failed to generate</h3>
                <button onClick={() => setShowErrorModal(false)} className="text-gray-400 hover:text-gray-500"> <X className="w-5 h-5" /> </button>
              </div>
              <p className="font-medium text-gray-600">{parseError(errorMessage)}</p>
            </div>
          </div>
        )}
        {showHistoryModal && <PromptHistoryModal history={promptHistory} onRestore={handleRestoreFromHistory} onClose={() => setShowHistoryModal(false)} />}
      </div>
    </>
  );
}