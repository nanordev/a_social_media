const passport = require('passport');
const mongoose = require('mongoose');
const { query } = require('express');
const User = mongoose.model('User');


const containsDuplicate = function (array) {
    array.sort();
    for (let i = 0; i < array.length; i++) {
        if (array[i] == array[i + 1]) {
            return true
        }
    }
}


const registerUser = function ({ body }, res) {

    if (!Object.values(body).every((val) => val)) {
        return res.send({ msessage: "All Fieds are Required" })
    }
    if (body.password !== body.password_confirm) {
        return res.send({ msessage: "Passwords don't match." })
    }

    const user = new User();

    user.name = body.first_name.trim() + " " + body.last_name.trim();

    user.email = body.email;
    user.setPassword(body.password);

    user.save((err, newUser) => {
        if (err) {
            if (err.errmsg && err.errmsg.includes("duplicate key error")) {
                return res.json({ message: "The provided email is already registered" })
            }
            return res.json({ message: "Something went wrong." })
        } else {
            const token = user.getJwt();
            res.status(201).json({ token })
        }
    })
}

const loginUser = function (req, res) {
    let body = req.body

    if (!body.email || !body.password) {
        return res.status(400).json({ message: "All fields are required" })
    }
    passport.authenticate("local", (err, user, info) => {
        if (err) { return res.status(404).json(err) }
        if (user) {
            const token = user.getJwt()
            res.status(201).json({ token })
        } else {
            res.json(info);
        }
    })(req, res);
}

const generateFeed = function (req, res) {
    res.status(200).json({ message: "Generating posts for a user's feed." });
}

const getSearchResults = function ({ query, payload }, res) {

    if (!query.query) { return res.json({ err: "Missing a query" }) }
    User.find({ name: { $regex: query.query, $options: "i" } }, "name friends friend_requests", (err, results) => {
        if (err) { return res.json({ err: err }) }
        results = results.slice(0, 20);
        for (let i = 0; i < results.length; i++) {
            if (results[i]._id == payload._id) {
                results.splice(i, 1);
                break;
            }
        }

        return res.status(200).json({ message: "Getting Search Results", results: results })
    })

}

const makeFriendRequest = function ({ params }, res) {

    User.findById(params.to, (err, user) => {
        if (err) { return res.json({ err: err }) }
        if (containsDuplicate([params.from, ...user.friend_requests])) {
            return res.json({message: "Friend request is already sent."})

        }
        user.friend_requests.push(params.from)
        user.save((err, user) => {
            if (err) { return res.json({ err: err }) }
            return res.statusJson(201, {message: "Successfully sent friend request" })
        })
    })
}

const getUserData = function({params}, res) {
    User.findById(params.userid, (err, user) => {
        if (err) { return res.json({ err: err }) }
        res.statusJson(200, {user: user})
    })
}

const getFriendRequests = function({query}, res) {
    let friendRequests = JSON.parse(query.friend_requests)

    User.find({ '_id' : {$in: friendRequests}}, "name profile_image", (err, users) => {
        if (err) { return res.json({ err: err }) }
        return res.statusJson(200, {message: "Getting friend requests", users: users})
    });
}

const resolveFriendRequest = function({query, params}, res) {

    User.findById(params.to, (err, user) => {
        if (err) { return res.json({ err: err }) }

        for(let i = 0; i < user.friend_requests.length; i++) {
            if(user.friend_requests[i] == params.from) {
                user.friend_requests.splice(i, 1);
                break;
            }
        }

        let promise = new Promise((resolve, reject) => {
            if(query.resolution == "accept") {

                if(containsDuplicate([params.from, ...user.friends])) {
                    return res.json({message: "Duplicate Error."})
                }
                user.friends.push(params.from)
                User.findById(params.from, (err, user) => {
                    if (err) { return res.json({ err: err }) }
                    if(containsDuplicate([params.to, ...user.friends])) {
                        return res.json({message: "Duplicate Error."})
                    }

                    user.friends.push(params.to)
                    user.save((err, user) => {
                        if (err) { return res.json({ err: err }) }
                        resolve();
                    })
                })
            } else {
                resolve()
            }
        })

        promise.then(() => {
            user.save((err, user) => {
                if (err) { return res.json({ err: err }) }
                res.statusJson(201, {message: "Resolved friend request",})
            })
        })
    })    
}















const deleteAllUsers = function (req, res) {
    User.deleteMany({}, (err, info) => {
        if (err) { return res.send({ error: err }); }
        return res.json({ message: "Deleted All Users", info: info })
    })
}


module.exports = {
    deleteAllUsers,
    registerUser,
    loginUser,
    generateFeed,
    getSearchResults,
    makeFriendRequest,
    getUserData,
    getFriendRequests,
    resolveFriendRequest
}