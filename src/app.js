import express from 'express';
//쿠키 파서...
import cookieParser from 'cookie-parser';
import UsersRouter from './users.router.js';
import CharacterRouter from './character.router.js';
import ItemRouter from './item.router.js';
import InventoryRouter from './inventory.router.js';

const app = express();
const PORT = 3011;

app.use(express.json());
app.use(cookieParser());

app.use('/api', [UsersRouter, CharacterRouter, ItemRouter, InventoryRouter]);

app.listen(PORT, () => {
    console.log(PORT, '포트로 서버가 열렸어요!');
});
