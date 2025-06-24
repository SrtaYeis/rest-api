const express = require('express');
const { CosmosClient } = require('@azure/cosmos');

const app = express();
app.use(express.json());

// Obtener la cadena de conexión desde la variable de entorno configurada por Service Connector
const connectionString = process.env.AZURE_COSMOS_CONNECTIONSTRING;
if (!connectionString) {
    console.error('Error: La cadena de conexión de Cosmos DB no está configurada.');
    process.exit(1);
}

const client = new CosmosClient(connectionString);
const databaseId = 'SampleDB';
const containerIds = {
    pelicula: 'resena_pelicula',
    sede: 'reseña_sede'
};

// Función para obtener o crear un contenedor
async function getContainer(containerId) {
    try {
        const { database } = await client.databases.createIfNotExists({ id: databaseId });
        const { container } = await database.containers.createIfNotExists({ id: containerId });
        return container;
    } catch (error) {
        console.error(`Error al obtener el contenedor ${containerId}:`, error.message);
        throw error;
    }
}

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({
        message: 'Bienvenido a la API Zynemax+',
        status: 'running',
        endpoints: {
            post: '/api/review/:type (crear reseña)',
            get: '/api/reviews/:type (ver todas las reseñas)',
            get: '/api/review/:type/:dni (ver reseña específica)',
            put: '/api/review/:type/:dni (actualizar reseña)',
            delete: '/api/review/:type/:dni (eliminar reseña)'
        }
    });
});

// Listar todas las reseñas de un tipo (GET)
app.get('/api/reviews/:type', async (req, res) => {
    const { type } = req.params;

    if (!containerIds[type]) {
        return res.status(400).json({ error: 'Tipo de reseña no válido' });
    }

    const container = await getContainer(containerIds[type]);
    try {
        const { resources } = await container.items.readAll().fetchAll();
        if (resources.length === 0) {
            return res.status(404).json({ error: 'No se encontraron reseñas' });
        }
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar las reseñas', details: error.message });
    }
});

// Crear una reseña (POST)
app.post('/api/review/:type', async (req, res) => {
    const { type } = req.params;
    const { dni, nombre, comentario, puntuacion, id } = req.body;

    if (!containerIds[type] || !dni || !nombre || !comentario || !puntuacion || !id) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (dni, nombre, comentario, puntuacion, id)' });
    }

    const container = await getContainer(containerIds[type]);
    const document = {
        dni,
        nombre,
        comentario,
        puntuacion: parseInt(puntuacion),
        [type === 'pelicula' ? 'id_pelicula' : 'id_sede']: id,
        timestamp: new Date().toISOString()
    };

    try {
        const { resource } = await container.items.upsert(document);
        res.status(201).json(resource);
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar la reseña', details: error.message });
    }
});

// Leer una reseña específica (GET)
app.get('/api/review/:type/:dni', async (req, res) => {
    const { type, dni } = req.params;

    if (!containerIds[type]) {
        return res.status(400).json({ error: 'Tipo de reseña no válido' });
    }

    const container = await getContainer(containerIds[type]);
    try {
        const { resources } = await container.items.query({
            query: 'SELECT * FROM c WHERE c.dni = @dni',
            parameters: [{ name: '@dni', value: dni }]
        }).fetchAll();
        if (resources.length === 0) {
            return res.status(404).json({ error: 'Reseña no encontrada' });
        }
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar la reseña', details: error.message });
    }
});

// Actualizar una reseña (PUT)
app.put('/api/review/:type/:dni', async (req, res) => {
    const { type, dni } = req.params;
    const { nombre, comentario, puntuacion, id } = req.body;

    if (!containerIds[type] || !dni) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (dni)' });
    }

    const container = await getContainer(containerIds[type]);
    const document = {
        dni,
        nombre,
        comentario,
        puntuacion: parseInt(puntuacion),
        [type === 'pelicula' ? 'id_pelicula' : 'id_sede']: id,
        timestamp: new Date().toISOString()
    };

    try {
        const { resource } = await container.item(dni).replace(document);
        res.json(resource);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la reseña', details: error.message });
    }
});

// Eliminar una reseña (DELETE)
app.delete('/api/review/:type/:dni', async (req, res) => {
    const { type, dni } = req.params;

    if (!containerIds[type]) {
        return res.status(400).json({ error: 'Tipo de reseña no válido' });
    }

    const container = await getContainer(containerIds[type]);
    try {
        await container.item(dni).delete();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la reseña', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Zynemax+ corriendo en el puerto ${PORT}`));
