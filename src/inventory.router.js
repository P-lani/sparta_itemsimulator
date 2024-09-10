import express from 'express';
import { prisma } from '../index.js';
import joi from 'joi';
//로그인 검증한것 가져오기
import loginAuth from './middlewares/user.auth.middleware.js';
// 캐릭터 인증만하는 미들웨어
import CharacterAuth from './middlewares/character.check.middleware.js';

const router = express.Router();

// 인벤토리 아이템 조회
// 장착된 아이템은 보이지 않아야한다
router.get('/inventory/search/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
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
// 장비 아이템이 아닌걸 장착할수 없어야한다..
// 그..... 트랜잭션을 구현할 필요가 있다
router.put('/inventory/equip/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
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

    // 장비 아이템이 아닌 경우
    if (findInventoryId.itemType < 10) {
        return res.status(200).json({ message: ' 장착 할 수 없는 아이템 입니다. ' });
    }

    // 장착할 아이템과 같은 type이 있는지 또 조회...?
    const findEquip = await prisma.inventory.findFirst({
        where: {
            characterId: parseInt(character_id_auth),
            itemType: findInventoryId.itemType,
            equippedItem: true,
        },
    });

    if (findEquip) {
        return res.status(200).json({ message: ' 해당 부위에 이미 장착된 아이템이 있습니다. ' });
    }

    // 능력치 적용을 위해 해당 아이템의 데이터를 조회
    const findItem = await prisma.items.findFirst({
        where: {
            itemId: findInventoryId.itemId,
        },
    });

    // 장착 실행
    await prisma.inventory.update({
        data: {
            equippedItem: true,
        },
        where: {
            inventoryId: findInventoryId.inventoryId,
        },
    });

    // 능력치 적용
    await prisma.character.update({
        data: {
            characterAttack: req.character.characterAttack + findItem.itemAttack,
            characterHealth: req.character.characterHealth + findItem.itemHealth,
        },
        where: {
            characterId: parseInt(character_id_auth),
        },
    });

    return res.status(201).json({ message: `아이템을 장착 했습니다.` });
});

//장착된 아이템 조회 API
router.get('/inventory/equipped_item/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
    const { character_id_auth } = req.params;

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
// 해제시 능력치 감소
// 트랜잭션 필요..?
router.put('/inventory/un_equip/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
    try {
        const { character_id_auth } = req.params;
        const { itemId } = req.body;

        // 대상 아이템 조회
        const equipped = await prisma.inventory.findFirst({
            where: {
                characterId: parseInt(character_id_auth),
                itemId: parseInt(itemId),
                equippedItem: true,
            },
        });
        // 장착 해제
        await prisma.inventory.update({
            data: {
                equippedItem: false,
            },
            where: {
                inventoryId: equipped.inventoryId,
            },
        });

        // 아이템을 조회...최적화 방법을 생각해보자
        const findItem = await prisma.items.findFirst({
            where: {
                itemId: equipped.itemId,
            },
        });
        // 능력치 감소
        await prisma.character.update({
            data: {
                characterAttack: req.character.characterAttack - findItem.itemAttack,
                characterHealth: req.character.characterHealth - findItem.itemHealth,
            },
            where: {
                characterId: parseInt(character_id_auth),
            },
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(201).json({ message: ' 아이템 장착이 해제되었습니다. ' });
});

export default router;
