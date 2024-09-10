import express from 'express';
import { prisma } from '../index.js';
import joi from 'joi';
//로그인 검증한것 가져오기
import loginAuth from './middlewares/user.auth.middleware.js';
//인증 모듈
import jwt from 'jsonwebtoken';

const router = express.Router();

//joi 를 통한 유효성 검사
const createdSchema = joi.object({
    characterName: joi.string().min(1).max(10).required(),
});

//캐릭터 생성 API
router.post('/new_char', loginAuth, async (req, res, next) => {
    try {
        const newCharJoi = await createdSchema.validateAsync(req.body);

        const { characterName } = newCharJoi;
        const { userId } = req.user;

        const newChar = await prisma.character.create({
            data: {
                userId: parseInt(userId),
                characterName: characterName,
            },
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(201).json({ message: '캐릭터를 생성했습니다.' });
});

// 캐릭터 상세조회 API
// 캐릭터Id를 params로 해당 캐릭터를 검색
// 본인 계정의 캐릭터인 경우 Money 까지 표시

router.get('/character/search/:character_id', async (req, res, next) => {
    try {
        const { character_id } = req.params;
        const { authorization } = req.cookies;
        let decodedToken = {};

        if (authorization) {
            const [tokenType, token] = authorization.split(' ');
            decodedToken = jwt.verify(token, process.env.SECRET_KEY);
        }

        const findCharId = await prisma.character.findFirst({
            where: { characterId: parseInt(character_id) },
        });

        const findCharacterInfo = await prisma.character.findFirst({
            where: { characterId: parseInt(character_id) },

            select: {
                characterName: true,
                characterAttack: true,
                characterHealth: true,
                characterMoney: decodedToken.userId === findCharId.userId ? true : false,
            },
        });

        return res.status(200).json({ data: findCharacterInfo });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// 모든 캐릭터 조회 API

router.get('/character/search_all', async (req, res, next) => {
    const searchAll = await prisma.character.findMany({
        select: {
            characterId: true,
            userId: true,
            characterName: true,
            characterMoney: false,
            characterAttack: false,
            characterHealth: false,
            characterInventorySize: false,
        },
    });
    return res.status(200).json({ data: searchAll });
});

// 캐릭터 삭제 API
// 로그인한 계정의 캐릭터만 삭제 가능
// 추가로 로그인 비밀번호가 일치하는지 확인...은 힘들듯

router.delete('/character/:delete_character', loginAuth, async (req, res, next) => {
    const { delete_character } = req.params;
    const { userId } = req.user;

    const deleteChar = await prisma.character.findFirst({
        where: { characterId: parseInt(delete_character) },
    });
    if (!deleteChar) {
        return res.status(401).json({ message: '존재하지 않는 캐릭터입니다. ' });
    }

    // 로그인한 계정의 캐릭터일 때
    if (deleteChar.userId === userId) {
        await prisma.character.delete({
            where: { characterId: parseInt(delete_character) },
        });
        return res.status(201).json({ data: '캐릭터가 삭제되었습니다. ' });
    } else {
        return res.status(400).json({ message: '계정 내의 캐릭터가 아닙니다. ' });
    }
});

export default router;
