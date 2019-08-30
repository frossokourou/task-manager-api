const express = require('express')
const Task = require('../models/task')
const auth = require('../middleware/auth')
const router = new express.Router()

router.post('/tasks', auth, async (req, res) => {
    const task = new Task({
        ...req.body,
        owner: req.user._id
    })

    try {
        await task.save()
        res.status(201).send(task)
    } catch (e) {
        res.status(400).send()
    }
})

// Pagination + sorting
// GET /tasks?completed=false
// GET /tasks?limit=10&skip=10
// GET /tasks?sortBy=createdAt:desc
router.get('/tasks', auth, async (req, res) => {
    const match = {}
    const sort = {}
    
    if (req.query.completed) {      // if there is a value provided by url
        match.completed = req.query.completed === 'true'        // sets completed either true or false (boolean not string)
    }

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':')
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1       // sort.parts[0] may be createdAt or the field to sort by
    }

    try {
        await req.user.populate({       // pass the search criterion -> match
            path: 'tasks',
            match,                       // match is true, false or empty obj that brings all tasks
            options: {
                limit: parseInt(req.query.limit),        // the url contains strings, should turn it to number so as not to be ignored
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate()
        res.send(req.user.tasks)
    } catch (e) {
        res.status(500).send()
    }
})

router.get('/tasks/:id', auth, async (req, res) => {
    const _id = req.params.id
    
    try {
        const task = await Task.findOne({ _id, owner: req.user._id})

        if (!task) {
            return res.status(404).send()
        }
        res.send(task)
    } catch (e) {
        res.status(500).send()
    }
})

router.patch('/tasks/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['description', 'completed']
    const isValidOperation = updates.every((elem) => allowedUpdates.includes(elem))

    if (!isValidOperation) {
        return res.status(400).send({ error: "Invalid updates" })
    } 

    try {
        const task = await Task.findOne({ _id: req.params.id, owner: req.user._id })

        if (!task) {
            return res.status(404).send()
        } 

        updates.forEach((update) => task[update] = req.body[update])
        await task.save()

        res.send(task)
    } catch (e) {
        res.status(400).send(e.message)
    }
})

router.delete('/tasks/:id', auth, async (req, res) => {
    console.log(req.params)
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
        
        if (!task) {
            return res.status(404).send()
        } 

        res.send(task)
    } catch (e) {
        res.status(500).send()
    }
})

module.exports = router