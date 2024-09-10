import jwt from 'jsonwebtoken';
import { prisma } from '../../index.js';

export default async function (req, res, next) {
    const authorization = req.headers['authorization'];

    try {
        // 로그인 안했을 때
        if (!authorization) {
            throw new Error('로그인 정보가 존재하지 않습니다.');
        }

        //Bearer 와 토큰 구분
        const [tokenType, token] = authorization.split(' ');

        if (!tokenType === 'Bearer') {
            throw new Error('잘못된 접근입니다.');
        }

        //jwt 복호화
        const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

        //검증 후 uesrId, characterId 추출
        const userId = decodedToken.userId;

        // 유저 Id 찾아오기
        const user = await prisma.users.findFirst({
            where: { userId: +userId },
        });

        if (!user) {
            throw new Error('사용자 정보가 존재하지 않습니다.');
            //  return res.status(400).json({ message: ' 사용자 정보가 존재하지 않습니다. '});
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}
