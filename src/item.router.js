import express from 'express';
import { prisma } from '../index.js';
//로그인 검증한것 가져오기
import authMiddleware from './middlewares/user.auth.middleware.js';
import loginAuth from './middlewares/user.auth.middleware.js';
import CharacterAuth from './middlewares/character.check.middleware.js';
const router = express.Router();

// 아이템 생성 API
// 아무나 마음대로..?
// joi 해야함
router.post('/item/make', async (req, res, next) => {
    const { itemName, itemPrice, itemInfo, itemAttack, itemHealth, itemType } = req.body;

    const findItem = await prisma.items.findFirst({
        where: { itemName },
    });
    if (findItem) {
        return res.status(409).json({ message: '이미 사용중인 아이템 이름 입니다. ' });
    }

    const makeItem = await prisma.items.create({
        data: {
            itemName,
            itemPrice,
            itemInfo,
            itemAttack,
            itemHealth,
            itemType,
        },
    });

    return res.status(201).json({ message: ' 아이템이 성공적으로 생성되었습니다. ' });
});

// 아이템 수정 API
// 가격 제외 아무나 가능
router.put('/item/modify/:item_id', async (req, res, next) => {
    const { item_id } = req.params;
    const { itemName, itemAttack, itemHealth, itemInfo } = req.body;

    const itemModify = await prisma.items.update({
        data: { itemName, itemAttack, itemHealth, itemInfo },
        where: { itemId: parseInt(item_id) },
    });
    return res.status(200).json({ message: ' 아이템이 수정되었습니다. ' });
});

// 아이템 전체 조회
router.get('/item/search_all', async (req, res, next) => {
    const itemSearchAll = await prisma.items.findMany({
        select: {
            itemId: true,
            itemName: true,
            itemPrice: true,
            itemAttack: false,
            itemHealth: false,
            itemInfo: false,
        },
    });
    return res.status(200).json({ data: itemSearchAll });
});

// 아이템 상세 조회
router.get('/item/search/:item_id', async (req, res, next) => {
    const { item_id } = req.params;

    const itemLook = await prisma.items.findFirst({
        where: { itemId: parseInt(item_id) },
        select: {
            itemId: true,
            itemName: true,
            itemPrice: true,
            itemInfo: true,
            itemAttack: true,
            itemHealth: true,
        },
    });
    return res.status(200).json({ data: itemLook });
});

// 아이템 획득....이 아니라 구매
router.post('/item/buy/:character_id_auth', loginAuth, CharacterAuth, async (req, res, next) => {
    const { character_id_auth } = req.params;
    const { itemId } = req.body;

    const findItem = await prisma.items.findFirst({
        where: { itemId: parseInt(itemId) },
    });

    if (!findItem) {
        return res.status(400).json({ message: ' 잘못된 아이템 정보 입니다. ' });
    }
    const inventorySlot = await prisma.inventory.findFirst({
        where: {
            characterId: parseInt(character_id_auth),
        },
        orderBy: {
            inventoryNumber: 'desc',
        },
    });

    // 돈 없을 때
    if (req.character.characterMoney < findItem.itemPrice) {
        return res.status(201).json({ message: ` 골드가 부족합니다. 소지금 : ${req.character.characterMoney} ` });
    }
    // 돈 계산 (선불)
    await prisma.character.update({
        data: {
            characterMoney: req.character.characterMoney - findItem.itemPrice,
        },
        where: {
            characterId: parseInt(character_id_auth),
        },
    });

    // 아이템 생성
    await prisma.inventory.create({
        data: {
            itemId: findItem.itemId,
            characterId: parseInt(character_id_auth),
            inventoryNumber: inventorySlot === null ? 1 : inventorySlot.inventoryNumber + 1,
            itemType: findItem.itemType,
        },
    });

    return res.status(201).json({ message: ` ${findItem.itemName}을 구매했습니다. ` });
});

// 아이템 판매
router.delete('/item/sell/:character_id_auth', loginAuth, CharacterAuth);

export default router;
