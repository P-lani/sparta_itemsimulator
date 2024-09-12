import express from 'express';
import { prisma } from '../index.js';
import joi from 'joi';
//로그인 검증한것 가져오기
import loginAuth from './middlewares/user.auth.middleware.js';
// 캐릭터 인증만하는 미들웨어
import CharacterAuth from './middlewares/character.check.middleware.js';

//인증 모듈
import jwt from 'jsonwebtoken';

const router = express.Router();

//joi 를 통한 유효성 검사
const createdSchema = joi.object({
    characterName: joi.string().min(1).max(10).required(),
});

//캐릭터 생성 API
// JWT 인증 필요
router.post('/new_char', loginAuth, async (req, res, next) => {
    try {
        const newCharJoi = await createdSchema.validateAsync(req.body);
        const { characterName } = newCharJoi;
        const { userId } = req.user;

        const findName = await prisma.character.findFirst({
            where: {
                characterName: characterName,
            },
        });

        if (findName) {
            return res.status(400).json({ message: '이미 존재하는 캐릭터 이름 입니다.' });
        }

        const newChar = await prisma.character.create({
            data: {
                userId: parseInt(userId),
                characterName: characterName,
            },
        });

        return res.status(201).json({ message: '캐릭터를 생성했습니다.' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// 캐릭터 상세조회 API
// 캐릭터Id를 params로 해당 캐릭터를 검색
// 본인 계정의 캐릭터인 경우 Money 까지 표시

router.get('/character/search/:character_id', async (req, res, next) => {
    try {
        const { character_id } = req.params;
        const { authorization } = req.headers;
        let decodedToken = {};

        // JWT를 포함하여 요청한 경우 해당 코드 복호화
        if (authorization) {
            const [tokenType, token] = authorization.split(' ');
            decodedToken = jwt.verify(token, process.env.SECRET_KEY);
        }

        // 해당 캐릭터 조회
        // 아래 select에서 삼항연산자를 사용하기 위해서
        const findCharId = await prisma.character.findFirst({
            where: { characterId: parseInt(character_id) },
        });

        if (!findCharId) {
            throw new Error('없는 캐릭터 번호 입니다.');
        }
        // select 로 출력 내용 선정
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
// JWT 인증 필요 + 캐릭터 인증 필요
router.delete('/character/delete/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
    const { character_id_auth } = req.params;

    //미들웨어로 검증을 다 했기 때문에 바로 조회하여 삭제
    await prisma.character.delete({
        where: { characterId: parseInt(character_id_auth) },
    });

    return res.status(200).json({ message: '캐릭터가 삭제되었습니다. ' });
});

// Show me the money
router.put('/show_me_the_money/:character_id_auth', [loginAuth, CharacterAuth], async (req, res, next) => {
    const { character_id_auth } = req.params;

    const moneyGet = await prisma.character.update({
        data: {
            characterMoney: req.character.characterMoney + 100,
        },
        where: {
            characterId: parseInt(character_id_auth),
        },
    });

    return res.status(200).json({ message: ` 100G 를 획득 했습니다. 소지금 : ${moneyGet.characterMoney}G ` });
});

export default router;
