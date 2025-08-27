import { useCallback, useEffect, useRef, useState } from 'react';
import Graph from '../utils/Graph';
import { NodeState } from '../utils/Graph';

export const useGraphManager = () => {
  console.log('useGraphManager hook initializing...'); // Debug log
  
  const [graph] = useState(() => new Graph());
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null, targetId: null });
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingEdgeId, setEditingEdgeId] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [step, setStep] = useState(0);
  
  const canvasRef = useRef(null);

  // Função para iniciar o algoritmo no backend
  const startAlgorithm = async (algorithm = 'bfs') => {
    try {
      // Garante que algorithm seja uma string válida
      const algorithmName = typeof algorithm === 'string' ? algorithm : 'bfs';
      
      const graphData = graph.exportToJSON();
      
      // Garante que apenas dados primitivos sejam enviados
      const cleanNodes = graphData.nodes.map(node => ({
        id: Number(node.id),
        x: Number(node.x),
        y: Number(node.y),
        weight: node.weight !== null ? Number(node.weight) : null
      }));
      
      const cleanEdges = graphData.edges.map(edge => ({
        id: Number(edge.id),
        from: Number(edge.from),
        to: Number(edge.to),
        weight: edge.weight !== null ? Number(edge.weight) : null,
        directed: Boolean(edge.directed)
      }));
      
      const requestData = {
        nodes: cleanNodes,
        edges: cleanEdges,
        algorithm: algorithmName,
        source: graph.currentNode !== null ? Number(graph.currentNode) : null
      };

      console.log('Dados sendo enviados para o backend:', requestData);

      const response = await fetch('http://localhost:5000/api/grafo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', 
        body: JSON.stringify(requestData)
      });
      

      if (!response.ok) {
        throw new Error('Erro ao iniciar algoritmo no backend');
      }

      console.log('Algoritmo iniciado no backend');
      return true;
    } catch (error) {
      console.error('Erro ao iniciar algoritmo:', error);
      return false;
    }
  };

  // Função para executar um passo do algoritmo
  const executeStep = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' 
      });

      if (!response.ok) {
        throw new Error('Erro ao executar passo do algoritmo');
      }

      const data = await response.json();
      
      // Atualiza o grafo com os dados retornados (formato complexo da API)
      graph.importFromJSONAPI(data);
      updateNodesState();
      
      // Atualiza o step
      setStep(data.step || 0);
      
      // Verifica se o algoritmo terminou
      if (data.finished) {
        setStep(4); // Define step como 4 quando finished
        stopAnimation();
        // Reseta todos os nós para o estado DEFAULT
        nodes.forEach(node => {
          graph.setNodeState(node.id, NodeState.DEFAULT);
        });
        updateNodesState();
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao executar passo:', error);
      stopAnimation();
      return null;
    }
  };

  // Função para iniciar a animação
  const startAnimation = async (algorithm = 'bfs') => {
    if (isAnimating) {
      stopAnimation();
      return;
    }

    // Garante que algorithm seja uma string válida
    const algorithmName = typeof algorithm === 'string' ? algorithm : 'bfs';

    // Inicia o algoritmo no backend
    const success = await startAlgorithm(algorithmName);
    if (!success) {
      console.error('Falha ao iniciar algoritmo');
      return;
    }

    setIsAnimating(true);
    
    // Executa o primeiro passo imediatamente
    await executeStep();
    
    // Configura o intervalo para executar passos a cada 1 segundo
    const newIntervalId = setInterval(async () => {
      await executeStep();
    }, 1000);
    
    setIntervalId(newIntervalId);
  };

  // Função para parar a animação
  const stopAnimation = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsAnimating(false);
  };

  // Função para executar próximo passo manualmente
  const nextStep = async () => {
    if (!isAnimating) {
      await startAlgorithm('bfs');
    }
    await executeStep();
  };

  // Função para reiniciar a animação
  const restartAnimation = async () => {
    stopAnimation();
    setStep(0);
    
    // Reseta o estado dos nós para DEFAULT
    nodes.forEach(node => {
      graph.setNodeState(node.id, NodeState.DEFAULT);
    });
    updateNodesState();
    
    // Reseta o currentNode no grafo
    graph.setCurrentNode(null);
    
    // Inicia novamente
    await startAnimation('bfs');
  };

  const handleSelectNode = (nodeId) => {
    // Se há um nó selecionado, reseta seu estado para DEFAULT
    if (selectedNode !== null) {
      graph.setNodeState(selectedNode, NodeState.DEFAULT);
    }
    
    // Se um novo nó foi selecionado, define seu estado como SELECTED
    if (nodeId !== null) {
      graph.setNodeState(nodeId, NodeState.SELECTED);
    }

    setSelectedNode(nodeId);
    graph.setCurrentNode(nodeId);
    
    // Atualiza o estado dos nós na interface
    updateNodesState();
  };

  // Atualiza o estado dos nós quando o grafo muda
  const updateNodesState = () => {
    setNodes(graph.getAllNodes());
  };

  // Manipula o duplo clique no canvas
  const handleCanvasDoubleClick = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Adiciona o novo nó
    const newNode = graph.addNode(x, y);
    updateNodesState();

    setEditingNodeId(newNode.id);

    // console.log(`Nó ${newNode.id} criado na posição (${x}, ${y})`);
  };

  // Manipula clique em um nó
  const handleNodeClick = (nodeId) => {
    hideContextMenu();
    if (selectedNode === null) {
      handleSelectNode(nodeId);
      // console.log(`Nó ${nodeId} selecionado`);
    } else if (selectedNode === nodeId) {
      handleSelectNode(null);
      // console.log(`Nó ${nodeId} deselecionado`);
    } else {
      // Conecta criando aresta direcionada selectedNode -> nodeId
      const edge = graph.addEdge(selectedNode, nodeId, { weight: null, directed: false });
      if (edge) {
        updateNodesState();
      } else {
        console.log(`Falha ao conectar nós ${selectedNode} -> ${nodeId} (pode já existir uma aresta)`);
      }

      // Após criar a aresta, adiciona o peso
      setEditingEdgeId(edge.id);

      //deseleciona o nó
      handleSelectNode(null);
    }
  };

  // Manipula duplo clique em um nó (editar peso do nó)
  const handleNodeDoubleClick = (nodeId) => {
    hideContextMenu();
    setEditingNodeId(nodeId);
  };

  const startEditNodeWeight = (nodeId) => {
    hideContextMenu();
    setEditingNodeId(nodeId);
  };

  const commitNodeWeight = (nodeId, value) => {
    const weight = value.trim() === '' ? null : Number(value);
    graph.setNodeWeight(nodeId, weight);
    setEditingNodeId(null);
    updateNodesState();
  };

  const cancelEditNodeWeight = () => {
    setEditingNodeId(null);
  };


  // Limpa o grafo
  const handleClearGraph = () => {
    // Para a animação se estiver rodando
    if (isAnimating) {
      stopAnimation();
    }
    
    // Reseta o step
    setStep(0);
    
    // Limpa o grafo
    graph.clear();
    setNodes([]);
    handleSelectNode(null);
    
    // Reseta o currentNode no grafo
    graph.setCurrentNode(null);
    
    console.log('Grafo limpo');
  };

  // Salva o grafo
  const handleSaveGraph = () => {
    const graphData = graph.exportToJSON();
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'grafo.json';
    link.click();
    
    console.log('Grafo salvo');
  };

  // Carrega o grafo
  const handleLoadGraph = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const graphData = JSON.parse(event.target.result);
            graph.importFromJSON(graphData);
            updateNodesState();
            handleSelectNode(null);
            console.log('Grafo carregado');
          } catch (error) {
            console.error('Erro ao carregar grafo:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const loadGraphFromPath = async (path) => {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Erro ao buscar o arquivo');
      const graphData = await response.json();
      graph.importFromJSON(graphData);
      updateNodesState();
      handleSelectNode(null);
      console.log('Grafo carregado de', path);
    } catch (error) {
      console.error('Erro ao carregar grafo:', error);
    }
  };

  // Double click na aresta: editar peso
  const handleEdgeDoubleClick = (edgeId) => {
    hideContextMenu();
    setEditingEdgeId(edgeId);
  };

  const commitEdgeWeight = (edgeId, value) => {
    const weight = value.trim() === '' ? null : Number(value);
    graph.setEdgeWeight(edgeId, weight);
    setEditingEdgeId(null);
    updateNodesState();
  };

  const cancelEditEdgeWeight = () => {
    setEditingEdgeId(null);
  };

  // Context menu helpers
  const showContextMenu = (x, y, type, targetId) => {
    setContextMenu({ visible: true, x, y, type, targetId });
  };
  const hideContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, type: null, targetId: null });

  const handleNodeContextMenu = (nodeId, e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, 'node', nodeId);
  };

  const handleEdgeContextMenu = (edgeId, e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, 'edge', edgeId);
  };

  // Ações de menu de contexto
  const deleteNode = () => {
    if (contextMenu.type !== 'node' || contextMenu.targetId == null) return;
    const nodeId = contextMenu.targetId;
    graph.removeNode(nodeId);
    if (selectedNode === nodeId) handleSelectNode(null);
    updateNodesState();
    hideContextMenu();
  };

  const deleteEdge = () => {
    if (contextMenu.type !== 'edge' || contextMenu.targetId == null) return;
    graph.removeEdge(contextMenu.targetId);
    updateNodesState();
    hideContextMenu();
  };

  const toggleEdgeDirected = () => {
    if (contextMenu.type !== 'edge' || contextMenu.targetId == null) return;
    const edge = graph.getEdge(contextMenu.targetId);
    if (!edge) return;
    graph.setEdgeDirected(edge.id, !edge.directed);
    updateNodesState();
    hideContextMenu();
  };

  // Renderização de arestas com direção e peso
  const renderEdges = () => {
    const elements = [];
    const edges = graph.getAllEdges();
    for (const edge of edges) {
      const from = graph.getNode(edge.from);
      const to = graph.getNode(edge.to);
      if (!from || !to) continue;

      const x1 = from.x;
      const y1 = from.y;
      const x2 = to.x;
      const y2 = to.y;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angleRad = Math.atan2(dy, dx);
      const angle = angleRad * 180 / Math.PI;

      const nodeRadius = 25; // tamanho visual do nó (metade de 50px)
      const startOffset = nodeRadius;
      const endOffset = nodeRadius; // para direcionadas e não-direcionadas, encurtamos ao chegar no nó
      const usable = Math.max(0, length - startOffset - endOffset);
      const startX = x1 + Math.cos(angleRad) * startOffset;
      const startY = y1 + Math.sin(angleRad) * startOffset;

      elements.push(
        <div
          key={`edge-${edge.id}`}
          className={`graph-edge ${edge.directed ? 'directed' : 'undirected'}`}
          style={{
            left: `${startX}px`,
            top: `${startY}px`,
            width: `${usable}px`,
            transform: `rotate(${angle}deg)`,
            transformOrigin: '0 50%'
          }}
          onDoubleClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleEdgeDoubleClick(edge.id); }}
          onContextMenu={(e) => handleEdgeContextMenu(edge.id, e)}
        >
          {editingEdgeId === edge.id ? (
            <input
              className="edge-weight-input"
              autoFocus
              defaultValue={edge.weight ?? ''}
              onBlur={(ev) => commitEdgeWeight(edge.id, ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') commitEdgeWeight(edge.id, ev.currentTarget.value);
                if (ev.key === 'Escape') cancelEditEdgeWeight();
              }}
              onDoubleClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); }}
              style={{
                left: `${usable / 2}px`,
                top: `-14px`,
                transform: `translate(-50%, -50%) rotate(${-angle}deg)`
              }}
            />
          ) : (
            <div
              className="graph-edge-label"
              style={{
                left: `${usable / 2}px`,
                top: `-14px`,
                transform: `translateX(-50%) rotate(${-angle}deg)`
              }}
              onDoubleClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); handleEdgeDoubleClick(edge.id); }}
            >
              {edge.weight != null ? edge.weight : ' '}
            </div>
          )}
        </div>
      );
    }
    return elements;
  };

  return {
    // Estados
    nodes,
    selectedNode,
    contextMenu,
    editingNodeId,
    editingEdgeId,
    canvasRef,
    isAnimating,
    step,
    
    // Funções
    updateNodesState,
    handleCanvasDoubleClick,
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeContextMenu,
    handleEdgeContextMenu,
    handleClearGraph,
    handleSaveGraph,
    handleLoadGraph,
    loadGraphFromPath,
    renderEdges,
    hideContextMenu,
    deleteNode,
    deleteEdge,
    toggleEdgeDirected,
    startEditNodeWeight,
    commitNodeWeight,
    cancelEditNodeWeight,
    startAnimation,
    stopAnimation,
    nextStep,
    restartAnimation,
    
    // Métodos do grafo (para informações)
    getNodeCount: () => graph.getNodeCount(),
    getEdgeCount: () => graph.getEdgeCount()
  };
};
