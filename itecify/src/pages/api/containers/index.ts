import type { NextApiRequest, NextApiResponse } from 'next';

interface ContainerRequest {
  sessionId: string;
  language: string;
  memoryLimit?: string;
  cpuLimit?: number;
  timeout?: number;
}

interface Container {
  id: string;
  sessionId: string;
  language: string;
  status: 'created' | 'running' | 'stopped' | 'error';
  memoryLimit: string;
  cpuLimit: number;
  timeout: number;
  createdAt: string;
}

const containers: Map<string, Container> = new Map();

function generateContainerId(): string {
  return `container-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleListContainers(req, res);
    case 'POST':
      return handleCreateContainer(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

function handleListContainers(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query;
  
  let containerList = Array.from(containers.values());
  
  if (typeof sessionId === 'string') {
    containerList = containerList.filter(c => c.sessionId === sessionId);
  }

  return res.status(200).json({ containers: containerList });
}

function handleCreateContainer(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId, language, memoryLimit = '512m', cpuLimit = 1, timeout = 30000 } = req.body as ContainerRequest;

  if (!sessionId || !language) {
    return res.status(400).json({ error: 'sessionId and language are required' });
  }

  const id = generateContainerId();
  const container: Container = {
    id,
    sessionId,
    language,
    status: 'created',
    memoryLimit,
    cpuLimit,
    timeout,
    createdAt: new Date().toISOString(),
  };

  containers.set(id, container);

  return res.status(201).json(container);
}
