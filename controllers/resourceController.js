const { query } = require('../config/db');
const { resources, insert, update } = require('../utils/dbHelpers');

class ResourceController {
    static async createResource(req, res) {
        try {
            const resourceData = {
                name: req.body.name,
                resource_type: req.body.resource_type,
                building: req.body.building,
                room: req.body.room,
                capacity: req.body.capacity,
                description: req.body.description,
                status: req.body.status || 'active',
                created_at: new Date()
            };
            
            const resourceId = await insert('resources', resourceData);
            const resource = await resources.findById(resourceId);
            
            res.status(201).json({ message: 'Resource created successfully', resource });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateResource(req, res) {
        try {
            const { resourceId } = req.params;
            const resource = await resources.findById(resourceId);
            
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' });
            }
            
            const updated = await resources.updateStatus(resourceId, req.body.status || resource.status);
            // Also update other fields if provided
            if (Object.keys(req.body).length > 0) {
                const updateData = { ...req.body };
                delete updateData.status; // Already handled
                await update('resources', 'resource_id', resourceId, updateData);
                const finalResource = await resources.findById(resourceId);
                return res.json({ message: 'Resource updated successfully', resource: finalResource });
            }
            
            res.json({ message: 'Resource updated successfully', resource: updated });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteResource(req, res) {
        try {
            const { resourceId } = req.params;
            const resource = await resources.findById(resourceId);
            
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' });
            }
            
            await query('DELETE FROM resources WHERE resource_id = ?', [resourceId]);
            res.json({ message: 'Resource deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllResources(req, res) {
        try {
            const allResources = await resources.getAll();
            res.json(allResources);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ResourceController;
