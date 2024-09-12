import express from 'express';
import { prisma } from '../index.js';
import joi from 'joi';
//로그인 검증한것 가져오기
import loginAuth from './middlewares/user.auth.middleware.js';
import CharacterAuth from './middlewares/character.check.middleware.js';

const router = express.Router();

const createdSchema = joi.object({
    itemName: joi.string().min(1).max(12).required(),
    itemPrice: joi.number().min(0).max(999999),
    itemInfo: joi.string().min(1).max(16),
    itemStatus: joi.any(),
    itemType: joi.number().min(9).max(18),
});

// 아이템 생성 API
// 인증이 필요없음.
router.post('/item/make', async (req, res, next) => {
    try {
        const signUpJoi = await createdSchema.validateAsync(req.body);
        const { itemName, itemPrice, itemInfo, itemStatus, itemType } = signUpJoi;

        const findItem = await prisma.items.findFirst({
            where: { itemName },
        });

        if (findItem) {
            throw new Error('이미 사용중인 아이템 이름 입니다.');
        }

        await prisma.items.create({
            data: {
                itemName,
                itemPrice,
                itemInfo,
                itemStatus,
                itemType,
            },
        });

        return res.status(201).json({ message: ' 아이템이 성공적으로 생성되었습니다. ' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// 아이템 수정 API
// 가격 수정 불가, 인증 필요없음
router.put('/item/modify/:item_id', async (req, res, next) => {
    try {
        const signUpJoi = await createdSchema.validateAsync(req.body);
        const { item_id } = req.params;
        const { itemName, itemStatus, itemInfo } = signUpJoi;

        const findItemId = await prisma.items.findFirst({
            where: {
                itemId: parseInt(item_id),
            },
        });

        if (!findItemId) {
            return res.status(409).json({ message: ' 존재하지 않는 아이템 아이디 입니다. ' });
        }

        await prisma.items.update({
            data: { itemName, itemStatus, itemInfo },
            where: {
                itemId: parseInt(item_id),
            },
        });

        return res.status(200).json({ message: ' 아이템이 수정되었습니다. ' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// 아이템 전체 조회
// 모든 아이템의 아이디, 이름, 가격만 조회
router.get('/item/search_all', async (req, res, next) => {
    const itemSearchAll = await prisma.items.findMany({
        select: {
            itemId: true,
            itemName: true,
            itemPrice: true,
            itemStatus: false,
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
            itemInfo: true,
            itemType: true,
            itemPrice: true,
            itemStatus: true,
        },
    });

    if (!itemLook) {
        return res.status(404).json({ message: '존재하지 않는 아이템 아이디 입니다.' });
    }

    return res.status(200).json({ data: itemLook });
});

// 아이템 획득
// 에서 변경된 아이템 구매
router.post('/item/buy/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
    try {
        const { character_id_auth } = req.params;
        const { itemId } = req.body;

        const findItem = await prisma.items.findFirst({
            where: { itemId: parseInt(itemId) },
        });

        if (!findItem) {
            throw new Error(' 존재하지 않는 아이템 아이디 입니다. ');
        }

        // 해당 캐릭터의 인벤토리 조회
        const findTargetItem = await prisma.inventory.findFirst({
            where: {
                characterId: parseInt(character_id_auth),
            },
            orderBy: {
                inventoryNumber: 'asc',
            },
        });

        // 해당 characterId 의 inventoryNumber 최소값 찾기
        // 해당 character가 보유한 아이템이 없을경우 1로 지정
        // 아이템을 보유중인 경우, 가장 작은 빈값을 찾음
        let nextMinNumber;
        if (!findTargetItem || findTargetItem.inventoryNumber !== 1) {
            nextMinNumber = 1;
        } else {
            const findMinNumber = await prisma.$queryRaw`
              SELECT min(inventory_number) FROM inventory 
              WHERE character_id =${findTargetItem.characterId} and inventory_number+1
              NOT IN (SELECT inventory_number FROM inventory WHERE character_id =${findTargetItem.characterId})`;
            nextMinNumber = findMinNumber[0]['min(inventory_number)'] + 1;
        }

        // 인벤토리 공간이 부족할 때
        if (nextMinNumber > req.character.characterInventorySize) {
            throw new Error(` 인벤토리 공간이 부족합니다. `);
        }

        // 돈 없을 때
        if (req.character.characterMoney < findItem.itemPrice) {
            throw new Error(` 골드가 부족합니다. 소지금 : ${req.character.characterMoney} `);
        }

        // 돈 계산 (나름 선불)
        await prisma.character.update({
            data: {
                characterMoney: req.character.characterMoney - findItem.itemPrice,
            },
            where: {
                characterId: parseInt(character_id_auth),
            },
        });

        // 아이템 생성
        // 위에서 찾은 최소값으로 inventoryNumber 설정
        await prisma.inventory.create({
            data: {
                itemId: findItem.itemId,
                characterId: parseInt(character_id_auth),
                inventoryNumber: nextMinNumber,
                itemType: findItem.itemType,
            },
        });

        return res.status(201).json({ message: ` ${findItem.itemName}  구매했습니다. ` });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// 아이템 판매
router.delete('/item/sell/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
    try {
        const { character_id_auth } = req.params;
        const { itemId } = req.body;

        // 인벤토리에서 해당 아이템 조회
        // 동일한 아이템이 있을경우 가장 낮은 number의 아이템을 임의로 지정
        // 장착되지 않은 아이템만 조회
        const findTarget = await prisma.inventory.findFirst({
            where: {
                itemId: parseInt(itemId),
                characterId: parseInt(character_id_auth),
                equippedItem: false,
            },
            orderBy: {
                inventoryNumber: 'asc',
            },
        });

        if (!findTarget) {
            throw new Error(' 보유하고 있지 않은 아이템 입니다. ');
        }

        const findItem = await prisma.items.findFirst({
            where: {
                itemId: parseInt(itemId),
            },
        });

        // 아이템 제거
        await prisma.inventory.delete({
            where: { inventoryId: findTarget.inventoryId },
        });

        // 판매 가격 (아이템 price의 0.6배)의 money를 획득
        await prisma.character.update({
            data: {
                characterMoney: req.character.characterMoney + findItem.itemPrice * 0.6,
            },
            where: { characterId: req.character.characterId },
        });

        return res.status(200).json({
            message: ` 아이템을 ${findItem.itemPrice * 0.6}G에 판매했습니다. 소지금:${req.character.characterMoney}G `,
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

export default router;
