/**
 * CORTEX FOUNDATION API ROUTES
 * 
 * This module provides API endpoints for the Cortex Foundation schema,
 * offering complete CRUD operations for users, workspaces, and spaces
 * following the unified entity architecture with prefixed UUIDs.
 */

import { Router } from 'express';
import { z } from 'zod';
import { cortexFoundationStorage } from './cortex-foundation-storage';
import {
  insertCortexFoundationUserSchema,
  insertCortexFoundationWorkspaceSchema,
  insertCortexFoundationSpaceSchema,
  insertCortexFoundationSpaceMemberSchema,
  insertCortexFoundationWorkspaceMemberSchema,
} from '@shared/cortex-foundation-schema';

const router = Router();

// =============================================================================
// USERS ROUTES
// =============================================================================

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await cortexFoundationStorage.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await cortexFoundationStorage.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/users', async (req, res) => {
  try {
    const validatedData = insertCortexFoundationUserSchema.parse(req.body);
    const user = await cortexFoundationStorage.createUser(validatedData);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.patch('/users/:id', async (req, res) => {
  try {
    const updates = insertCortexFoundationUserSchema.partial().parse(req.body);
    const user = await cortexFoundationStorage.updateUser(req.params.id, updates);
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    await cortexFoundationStorage.deleteUser(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// =============================================================================
// WORKSPACES ROUTES
// =============================================================================

// Get workspaces by user
router.get('/users/:userId/workspaces', async (req, res) => {
  try {
    const workspaces = await cortexFoundationStorage.getWorkspacesByUser(req.params.userId);
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching user workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Get workspace by ID
router.get('/workspaces/:id', async (req, res) => {
  try {
    const workspace = await cortexFoundationStorage.getWorkspaceById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json(workspace);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// Create new workspace
router.post('/workspaces', async (req, res) => {
  try {
    const validatedData = insertCortexFoundationWorkspaceSchema.parse(req.body);
    const workspace = await cortexFoundationStorage.createWorkspace(validatedData);
    res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// Update workspace
router.patch('/workspaces/:id', async (req, res) => {
  try {
    const updates = insertCortexFoundationWorkspaceSchema.partial().parse(req.body);
    const workspace = await cortexFoundationStorage.updateWorkspace(req.params.id, updates);
    res.json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// Delete workspace
router.delete('/workspaces/:id', async (req, res) => {
  try {
    await cortexFoundationStorage.deleteWorkspace(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// =============================================================================
// SPACES ROUTES
// =============================================================================

// Get all spaces
router.get('/spaces', async (req, res) => {
  try {
    const { workspaceId, parentSpaceId } = req.query;
    
    // Use raw SQL for now to bypass ORM issues
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    
    let query;
    if (workspaceId && parentSpaceId) {
      query = sql`
        SELECT * FROM cortex_foundation.spaces 
        WHERE workspace_id = ${workspaceId} 
        AND parent_space_id = ${parentSpaceId}
        AND is_archived = false
        ORDER BY display_order, name;
      `;
    } else if (workspaceId) {
      query = sql`
        SELECT * FROM cortex_foundation.spaces 
        WHERE workspace_id = ${workspaceId} 
        AND parent_space_id IS NULL
        AND is_archived = false
        ORDER BY display_order, name;
      `;
    } else {
      // Get all spaces for the default user
      query = sql`
        SELECT * FROM cortex_foundation.spaces 
        WHERE owner_user_id = 'cu_181de66a23864b2fac56779a82189691'
        AND is_archived = false
        ORDER BY display_order, name;
      `;
    }
    
    const result = await db.execute(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching spaces:', error);
    res.status(500).json({ error: 'Failed to fetch spaces' });
  }
});

// Get space by ID
router.get('/spaces/:id', async (req, res) => {
  try {
    const space = await cortexFoundationStorage.getSpaceById(req.params.id);
    if (!space) {
      return res.status(404).json({ error: 'Space not found' });
    }
    res.json(space);
  } catch (error) {
    console.error('Error fetching space:', error);
    res.status(500).json({ error: 'Failed to fetch space' });
  }
});

// Create new space
router.post('/spaces', async (req, res) => {
  try {
    const validatedData = insertCortexFoundationSpaceSchema.parse(req.body);
    const space = await cortexFoundationStorage.createSpace(validatedData);
    res.status(201).json(space);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating space:', error);
    res.status(500).json({ error: 'Failed to create space' });
  }
});

// Update space
router.patch('/spaces/:id', async (req, res) => {
  try {
    const updates = insertCortexFoundationSpaceSchema.partial().parse(req.body);
    const space = await cortexFoundationStorage.updateSpace(req.params.id, updates);
    res.json(space);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating space:', error);
    res.status(500).json({ error: 'Failed to update space' });
  }
});

// Delete space
router.delete('/spaces/:id', async (req, res) => {
  try {
    await cortexFoundationStorage.deleteSpace(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting space:', error);
    res.status(500).json({ error: 'Failed to delete space' });
  }
});

// Get space hierarchy
router.get('/spaces/:id/hierarchy', async (req, res) => {
  try {
    const hierarchy = await cortexFoundationStorage.getSpaceHierarchy(req.params.id);
    res.json(hierarchy);
  } catch (error) {
    console.error('Error fetching space hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch space hierarchy' });
  }
});

// =============================================================================
// SPACE MEMBERS ROUTES
// =============================================================================

// Get space members
router.get('/spaces/:spaceId/members', async (req, res) => {
  try {
    const members = await cortexFoundationStorage.getSpaceMembers(req.params.spaceId);
    res.json(members);
  } catch (error) {
    console.error('Error fetching space members:', error);
    res.status(500).json({ error: 'Failed to fetch space members' });
  }
});

// Add space member
router.post('/spaces/:spaceId/members', async (req, res) => {
  try {
    const memberData = {
      ...req.body,
      space_id: req.params.spaceId
    };
    const validatedData = insertCortexFoundationSpaceMemberSchema.parse(memberData);
    const member = await cortexFoundationStorage.addSpaceMember(validatedData);
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error adding space member:', error);
    res.status(500).json({ error: 'Failed to add space member' });
  }
});

// Update space member
router.patch('/spaces/:spaceId/members/:userId', async (req, res) => {
  try {
    const updates = insertCortexFoundationSpaceMemberSchema.partial().parse(req.body);
    const member = await cortexFoundationStorage.updateSpaceMember(
      req.params.spaceId,
      req.params.userId,
      updates
    );
    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating space member:', error);
    res.status(500).json({ error: 'Failed to update space member' });
  }
});

// Remove space member
router.delete('/spaces/:spaceId/members/:userId', async (req, res) => {
  try {
    await cortexFoundationStorage.removeSpaceMember(req.params.spaceId, req.params.userId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing space member:', error);
    res.status(500).json({ error: 'Failed to remove space member' });
  }
});

export default router;