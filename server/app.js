const express = require('express');
const fs = require('fs');
const path = require('path');
const hbs = require('hbs');
const MySQL = require('./utilsMySQL');

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

const db = new MySQL();
const isProxmox = !!process.env.PM2_HOME;

db.init({
    host: '127.0.0.1',
    port: 3306,
    user: isProxmox ? 'super' : 'root',
    password: '1234.', // Asegúrate de que esta sea la pass de tu DB
    database: 'sakila',
});

// Configuración de estáticos y vistas
app.use(express.static(path.join(__dirname, '../public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Helper para obtener datos del JSON
const getCommon = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error llegint common.json:", err);
        return { year: new Date().getFullYear(), title: "Sakila Web" };
    }
};

// RUTA INDEX: 5 pelis y 5 categorías
app.get('/', async (req, res) => {
    try {
        const common = getCommon();
        const movies = await db.query('SELECT title, release_year, film_id FROM film LIMIT 5');
        const categories = await db.query('SELECT name FROM category LIMIT 5');
        
        res.render('index', { movies, categories, common });
    } catch (err) { 
        console.error(err);
        res.status(500).send('Error a la Home'); 
    }
});

// RUTA MOVIES: 15 pelis con sus actores
app.get('/movies', async (req, res) => {
    try {
        const movies = await db.query(`
            SELECT f.title, f.release_year, 
            GROUP_CONCAT(a.first_name, ' ', a.last_name SEPARATOR ', ') AS actors
            FROM film f
            LEFT JOIN film_actor fa ON f.film_id = fa.film_id
            LEFT JOIN actor a ON fa.actor_id = a.actor_id
            GROUP BY f.film_id 
            LIMIT 15`);
        res.render('movies', { movies, common: getCommon() });
    } catch (err) { 
        res.status(500).send('Error a Movies'); 
    }
});

// RUTA CUSTOMERS: 25 clientes + 5 alquileres cada uno
app.get('/customers', async (req, res) => {
    try {
        const customers = await db.query('SELECT customer_id, first_name, last_name, email FROM customer LIMIT 25');
        
        // Obtenemos los alquileres para cada cliente
        for (let c of customers) {
            c.rentals = await db.query(`
                SELECT f.title 
                FROM rental r 
                JOIN inventory i ON r.inventory_id = i.inventory_id 
                JOIN film f ON i.film_id = f.film_id 
                WHERE r.customer_id = ? 
                LIMIT 5`, [c.customer_id]); // Uso de parámetros para evitar SQL Injection
        }
        
        res.render('customers', { customers, common: getCommon() });
    } catch (err) { 
        console.error(err);
        res.status(500).send('Error a Customers'); 
    }
});

app.listen(port, () => console.log(`Servidor a http://localhost:${port}`));