// 캐릭터 검증만 하는 middleware 입니다.
import { prisma } from '../../index.js';

export default async function (req, res, next) {
    try {
        const { character_id_auth } = req.params;
        const { userId } = req.user;

        const findCharacter = await prisma.character.findFirst({
            where: { characterId: parseInt(character_id_auth) },
        });

        if (findCharacter === null || findCharacter.userId !== userId) {
            throw new Error(' 계정 내 캐릭터가 아닙니다. ');
        }
        req.character = findCharacter;
        next();
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}
