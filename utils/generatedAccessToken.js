import jwt from 'jsonwebtoken'

const generatedAccessToken = async(userId, expiresIn = '5h')=>{
    const token = await jwt.sign({ id : userId},
        process.env.SECRET_KEY_ACCESS_TOKEN,
        { expiresIn : expiresIn}
    )

    return token
}

export default generatedAccessToken