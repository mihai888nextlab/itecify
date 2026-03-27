import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

interface Session {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
}

const sessions: Map<string, Session> = new Map();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleGetSession(req, res);
    case 'POST':
      return handleCreateSession(req, res);
    case 'PUT':
      return handleUpdateSession(req, res);
    case 'DELETE':
      return handleDeleteSession(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}

function handleGetSession(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    const allSessions = Array.from(sessions.values());
    return res.status(200).json({ sessions: allSessions });
  }

  const session = sessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.status(200).json(session);
}

function handleCreateSession(req: NextApiRequest, res: NextApiResponse) {
  const { name, ownerId } = req.body;

  const id = uuidv4();
  const session: Session = {
    id,
    name: name || 'Untitled Session',
    createdAt: new Date().toISOString(),
    ownerId: ownerId || 'anonymous',
  };

  sessions.set(id, session);

  return res.status(201).json(session);
}

function handleUpdateSession(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = sessions.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { name } = req.body;
  if (name) {
    session.name = name;
  }

  return res.status(200).json(session);
}

function handleDeleteSession(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const deleted = sessions.delete(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.status(204).end();
}
