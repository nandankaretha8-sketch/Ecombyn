const generatedOtp = ()=>{
    return (Math.floor(Math.random() * 900000) + 100000).toString()  /// 100000 to 999999 as string
}
export default generatedOtp