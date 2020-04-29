const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const AdminSchema = new mongoose.Schema({
    username: String,
    password: String,
    roles: String
})
AdminSchema.pre('save', function(next){
    const Admin = this

    if(!Admin.isModified('password')){
        return next()
    }
    bcrypt.genSalt((err, salt)=>{
        bcrypt.hash(Admin.password,salt,(err,hash)=>{
            Admin.password = hash
            next()
           })
      })

})
AdminSchema.methods.checkPassword = function(password){
    return new Promise((resolve, reject)=>{
        bcrypt.compare(password, this.password, (err, isMatch)=>{
            if(err){
                reject(err)
            }else{
                resolve(isMatch)
            }
        })
    })
    
}

const Admin = mongoose.model('Admin', AdminSchema)

module.exports = Admin