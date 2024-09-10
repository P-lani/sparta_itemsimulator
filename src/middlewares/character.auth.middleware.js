// 캐릭터 검증만 하는 middleware 입니다.
// 매 실행 시 DB 조회 발생
import { prisma } from '../../index.js';

export default async function (req, res) {
    try {
        const { character_id_auth } = req.params;
        const { userId } = req.user;

        console.log(req.params);

        const findCharacter = await prisma.character.findFirst({
            where: { characterId: parseInt(character_id_auth) },
        });

        if (findCharacter.userId !== userId) {
            return res.status(400).json({ message: ' 계정 내의 캐릭터가 아닙니다. ' });
        }
        req.character = findCharacter;
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
}
