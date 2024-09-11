import express from 'express';
import { prisma } from '../index.js';
import joi from 'joi';
//인증 모듈
import jwt from 'jsonwebtoken';
//암호화 모듈
import bcrypt from 'bcrypt';

const router = express.Router();
//joi 를 통한 유효성 검사

const createdSchema = joi.object({
    userName: joi.string().alphanum().min(6).max(12).required(),
    email: joi.string().email().required(),
    password: joi.string().alphanum().min(6).max(16).required(),
    userInfo: joi.string().min(1).max(24),
});

// 회원가입 API
router.post('/sign-up', async (req, res, next) => {
    try {
        const signUpJoi = await createdSchema.validateAsync(req.body);
        const { userName, email, password, userInfo } = signUpJoi;

        const isExistUser = await prisma.users.findFirst({
            where: { userName },
        });

        if (isExistUser) {
            throw new Error('이미 사용중인 아이디 입니다.');
        }

        const hashedPassword = await bcrypt.hash(password, 3);
        await prisma.users.create({
            data: { email, password: hashedPassword, userInfo, userName },
        });

        return res.status(201).json({ message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// 로그인 API
router.post('/sign_in', async (req, res, next) => {
    const { userName, password } = req.body;

    try {
        const user = await prisma.users.findFirst({ where: { userName } });

        if (!user) throw new Error('존재하지 않는 아이디 입니다.');

        if (!(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다. ' });

        // 로그인에 성공하면, 사용자의 userId를 바탕으로 토큰을 생성합니다.
        const token = jwt.sign({ userId: user.userId }, process.env.SECRET_KEY, { expiresIn: '1h' });
        res.header('authorization', `Bearer ${token}`);

        return res.status(200).json({ message: `로그인에 성공하였습니다.` });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

export default router;
