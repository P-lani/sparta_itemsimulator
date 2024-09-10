import express from 'express';
import { prisma } from '../index.js';
import joi from 'joi';
//로그인 검증한것 가져오기
import loginAuth from './middlewares/user.auth.middleware.js';
// 캐릭터 인증만하는 미들웨어
import CharacterAuth from './middlewares/character.auth.middleware.js';

const router = express.Router();

// 인벤토리 아이템 조회
// 본인 계정의 캐릭터인 경우만, 인벤토리의 아이템만 조회되어야함
// 장착된 아이템은 보이지 않아야한다
// itemName 을 퍼와야 하는데 ...join?

router.get('/inventory/search/:character_id_auth', loginAuth, async (req, res, next) => {
    const { character_id_auth } = req.params;

    const inventorySearchAll = await prisma.inventory.findMany({
        where: {
            characterId: parseInt(character_id_auth),
            equippedItem: false,
        },
        select: {
            inventoryId: false,
            inventoryNumber: true,
            characterId: false,
            itemId: true,
            itemType: true,
            // Items 를 join 해서 Name 추가
            Items: {
                select: {
                    itemName: true,
                },
            },
        },
    });

    // 평탄화 라는것이 있었습니다
    // map으로 value 만 뽑아서 재배치
    const dietResult = inventorySearchAll.map(extract => ({
        inventoryNumber: extract.inventoryNumber,
        itemId: extract.itemId,
        itemName: extract.Items.itemName,
        itemType: extract.itemType,
    }));

    return res.status(200).json({ data: dietResult });
});

// 인벤토리 아이템 장착 API
// 장착할 캐릭터를 param 으로 , 장착할 아이템을 body 로 받는다.
// 동일한 아이템 (같은 부위) 을 중복으로 장착할 수 없어야함
// 장착시 능력치 증가해야함
router.put('/inventory/equip/:character_id_auth', loginAuth, async (req, res, next) => {
    const { character_id_auth } = req.params;
    const { itemId } = req.body;

    // 장착 대상이 된 아이템 조회
    // itemid와 캐릭터id 로 검색하면 여러개 값이 나올 수 있다.
    const findInventoryId = await prisma.inventory.findFirst({
        where: {
            characterId: parseInt(character_id_auth),
            itemId: parseInt(itemId),
        },
        // 가장 낮은 번호인 아이템을 특정
        orderBy: {
            inventoryNumber: 'asc',
        },
    });

    // 장착할 아이템과 같은 type이 있는지 또 조회...?
    const findEquip = await prisma.inventory.findFirst({
        where: {
            characterId: parseInt(character_id_auth),
            itemType: findInventoryId.itemType,
            equippedItem: true,
        },
    });

    if (findEquip) {
        return res.status(400).json({ message: ' 해당 부위에 이미 장착된 아이템이 있습니다. ' });
    }
    await prisma.inventory.update({
        data: {
            equippedItem: true,
        },
        where: {
            inventoryId: findInventoryId.inventoryId,
        },
    });

    return res.status(201).json({ message: `아이템을 장착 했습니다.` });
});

//장착된 아이템 조회 API
router.get('/inventory/equipped_item/:character_id_auth', loginAuth, async (req, res, next) => {
    const { character_id_auth } = req.params;

    CharacterAuth(req, res, next);

    const equipped = await prisma.inventory.findMany({
        where: {
            characterId: parseInt(character_id_auth),
            equippedItem: true,
        },
        select: {
            inventoryId: false,
            equippedItem: false,
            inventoryNumber: false,
            characterId: false,
            itemId: true,
            itemType: true,
            Items: {
                select: {
                    itemName: true,
                },
            },
        },
    });

    const dietEquip = equipped.map(extract => ({
        itemId: extract.itemId,
        itemName: extract.Items.itemName,
        itemType: extract.itemType,
    }));
    return res.status(200).json({ data: dietEquip });
});

// 장착 해제 API

router.put('/inventory/un_equip/:character_id_auth', loginAuth, async (req, res, next) => {
    const { character_id_auth } = req.params;
    const { itemId } = req.body;

    const equipped = await prisma.inventory.findFirst({
        where: {
            characterId: parseInt(character_id_auth),
            itemId: parseInt(itemId),
            equippedItem: true,
        },
    });

    await prisma.inventory.update({
        data: {
            equippedItem: false,
        },
        where: {
            inventoryId: equipped.inventoryId,
        },
    });
    console.log(equipped);
    return res.status(201).json({ message: ' 아이템 장착이 해제되었습니다. ' });
});

export default router;
