const express = require('express');
const { CosmosClient } = require('@azure/cosmos');

const app = express();
app.use(express.json());

const endpoint = 'https://zynemaxplus.documents.azure.com:443/';
const key = 'tpRLhplpnWCpw3hhan7agVpevkc6gCoDtN6V38UdwWQ4vpSExq70wFor8CIBNU9aBEUv5V94IHPOACDb6Gpdnw==';
const client = new CosmosClient({ endpoint, key });
const databaseId = 'SampleDB';
const containerIds = {
    pelicula: 'resena_pelicula',
    sede: 'reseña_sede'
};

async function getContainer(containerId) {
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({ id: containerId });
    return container;
}

// Crear una reseña (Insert)
app.post('/api/review/:type', async (req, res) => {
    const { type } = req.params;
    const { dni, nombre, comentario, puntuacion, id } = req.body;
    if (!containerIds[type] || !dni || !comentario || !puntuacion || !id) {
        return res.status(400).json({ error: 'Datos incorrectos, por favor revisa' });
    }
    const container = await getContainer(containerIds[type]);
    const document = {
        dni,
        nombre,
        comentario,
        puntuacion: parseInt(puntuacion),
        [type === 'pelicula' ? 'id_pelicula' : 'id_sede']: id
    };
    try {
        const { resource } = await container.items.upsert(document);
        res.status(201).json(resource);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Leer una reseña (Select)
app.get('/api/review/:type/:dni', async (req, res) => {
    const { type, dni } = req.params;
    if (!containerIds[type]) return res.status(400).json({ error: 'Tipo no válido' });
    const container = await getContainer(containerIds[type]);
    try {
        const { resources } = await container.items.query(`SELECT * FROM c WHERE c.dni = @dni`, {
            parameters: [{ name: '@dni', value: dni }]
        }).fetchAll();
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar una reseña (Update)
app.put('/api/review/:type/:dni', async (req, res) => {
    const { type, dni } = req.params;
    const { nombre, comentario, puntuacion, id } = req.body;
    if (!containerIds[type] || !dni) return res.status(400).json({ error: 'Datos incorrectos' });
    const container = await getContainer(containerIds[type]);
    const document = {
        dni,
        nombre,
        comentario,
        puntuacion: parseInt(puntuacion),
        [type === 'pelicula' ? 'id_pelicula' : 'id_sede']: id
    };
    try {
        const { resource } = await container.item(dni).replace(document);
        res.json(resource);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar una reseña (Delete)
app.delete('/api/review/:type/:dni', async (req, res) => {
    const { type, dni } = req.params;
    if (!containerIds[type]) return res.status(400).json({ error: 'Tipo no válido' });
    const container = await getContainer(containerIds[type]);
    try {
        await container.item(dni).delete();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Zynemax+ corriendo en el puerto ${PORT}`));
