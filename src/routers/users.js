const express = require('express')
const multer = require('multer')
const sharp = require('sharp')
const User = require('../models/user')
const auth = require('../middleware/auth')
const { sendWelcomeEmail, sendCancellationEmail } = require('../emails/account')
const router = new express.Router()

router.post('/users', async (req, res) => {

    const user = new User(req.body)

    try {
        await user.save()

        sendWelcomeEmail(user.email, user.name)

        const token = await user.generateAuthToken()
        res.status(201).send({ user, token })
    } catch (e) {
        res.status(400).send(e)
    }
})

router.post('/users/login', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password)
        const token = await user.generateAuthToken()
        res.send({ user, token })
    } catch (e) {
        res.status(400).send(e.message)
    }
})

router.post('/users/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((elem) => {
            return elem.token !== req.token
        })
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send(e.message)
    }
})

router.post('/users/logoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = []
        console.log(req.user)
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send()
    }
}) 

//  pass middleware as an argument
router.get('/users/me', auth, async (req, res) => {
    res.send(req.user)

})

router.patch('/users/me', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['name', 'email', 'password', 'age']
    const isValidOperation = updates.every((elem) => allowedUpdates.includes(elem))

    if (!isValidOperation) {
        return res.status(400).send({ error: "Invalid updates" })
    }

    try {
        updates.forEach((update) => req.user[update] = req.body[update])        // req.user is returned from auth function
        await req.user.save()

        res.send(req.user)
    } catch (e) {
        res.status(400).send(e.message)
    }
})

router.delete('/users/me', auth, async (req, res) => {
    try {
        await req.user.remove()

        sendCancellationEmail(req.user.email, req.user.name)

        res.send(req.user)
    } catch (e) {
        res.status(500).send()
    }
})

// configure multer -> upload destination folder
const upload = multer({
    // dest: 'avatars',     if destination does not exist, retrieve file from req.file
    limits: {
        fileSize: 1000000,
        files: 1
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an image'))
        }

        cb(undefined, true)
    }
})

router.post('/users/me/avatar', auth, upload.single('avatar'), async (req, res) => {
    // buffer of the modified file
    const buffer = await sharp(req.file.buffer).resize({ width: 250, height: 250 }).png().toBuffer()
    req.user.avatar = buffer
    
    // req.user.avatar = req.user.buffer
    await req.user.save()
    res.send()
}, (error, req, res, next) => {     
    res.status(400).send({ error: error.message })
})

router.delete('/users/me/avatar', auth, async(req, res) => {
    req.user.avatar = undefined

    await req.user.save()
    res.send()
})

router.get('/users/:id/avatar', async(req, res) => {
    try {
        const user = await User.findById(req.params._id)

        if (!user || !user.avatar) {
            throw new Error()
        }

        res.set('Content-Type', 'image/png')               // sets response header
        res.send(user.avatar)
    } catch (e) {
        res.status(404).send()
    }
})

module.exports = router