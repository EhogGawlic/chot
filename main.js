const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const sql = require('mysql2')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const multer = require('multer')
const dotenv = require('dotenv')
dotenv.config()
async function generateAccessToken(username) {
    return jwt.sign({ username }, process.env.JSONKEY, {
        expiresIn: '3600s',
    })
}
async function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JSONKEY)

        return decoded
    } catch (e) {
        return null
    }
}
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
const storage = multer.memoryStorage()
const upload = multer({ storage })
let db = sql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.PASS,
    database: 'chot',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
})
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
})
app.get('/style.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css')
    res.sendFile(__dirname + '/style.css')
})
app.get('/mainscript.js', (req, res) => {
    res.sendFile(__dirname + '/mainscript.js')
})
app.post('/chats', async (req, res) => {
    if (!req.cookies.token) {
        res.status(401).send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.status(401).send('Not logged in')
        return
    }
    const usern = tkn.username
    const sql = `
    SELECT c.cId, c.cName
FROM chats c
JOIN chat_users cu ON cu.cId = c.cId
WHERE cu.Username = ?
`
    db.execute(sql, [usern], (err, results) => {
        if (err) {
            console.error(err)
            return
        }
        console.log(results)
        res.status(200).json(results)
    })
})
app.post('/chats/unread', async (req, res) => {
    if (!req.cookies.token) {
        res.status(401).send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.status(401).send('Not logged in')
        return
    }
    const username = tkn.username

    db.execute(
        `
    SELECT c.cId, c.cName,
           COUNT(m.msgId) AS unread
    FROM chats c
    JOIN chat_users cu ON cu.cId = c.cId
    LEFT JOIN chat_reads cr
      ON cr.cId = c.cId AND cr.Username = cu.Username
    LEFT JOIN messages m
      ON m.cId = c.cId
     AND m.msgId > IFNULL(cr.last_read_msg, 0)
    WHERE cu.Username = ?
    GROUP BY c.cId
    `,
        [username],
        (err, rows) => {
            if (err) return res.sendStatus(500)
            res.json(rows)
        }
    )
})
app.post('/create', async (req, res) => {
    if (!req.cookies.token) {
        res.status(401).send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.status(401).send('Not logged in')
        return
    }
    const usern = tkn.username
    const sql = 'INSERT INTO Chats (cName) VALUES (?);'
    db.execute(sql, [req.body.cname], (err, results) => {
        const id = results.insertId
        req.body.users.forEach((user, i) => {
            const sql2 = 'INSERT INTO chat_users (cId, Username) VALUES (?, ?);'
            db.execute(sql2, [id, user])
        })
        res.status(201).send('Created')
    })
})
app.post('/messages', async (req, res) => {
    if (!req.cookies.token) {
        res.status(401).send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.status(401).send('Not logged in')
        return
    }
    const usern = tkn.username
    const iicsql = `
    SELECT 1
FROM chat_users
WHERE cId = ? AND Username = ?
`
    db.execute(iicsql, [req.body.chat, usern], (err, result) => {
        if (err) {
            console.error(err)
            return
        }
        if (result.length == 0) {
            res.status(401).send('Unauthorized')
        }
        const sql = `SELECT *
FROM (
    SELECT m.msgId, m.content, m.created_at,
           u.Username, u.Dispn
    FROM messages m
    JOIN users u ON u.Username = m.sender
    WHERE m.cId = ?
    ORDER BY m.created_at DESC
    LIMIT 50
) AS last_msgs
ORDER BY created_at ASC;

    `
        db.execute(sql, [req.body.chat], (err, result) => {
            if (err) {
                console.error(err)
                return
            }
            const lastMsgId = result[result.length - 1]
                ? result[result.length - 1].msgId
                : 0

            db.execute(
                `
                INSERT INTO chat_reads (cId, Username, last_read_msg)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE last_read_msg = ?
                `,
                [req.body.chat, usern, lastMsgId, lastMsgId]
            )
            res.status(200).json(result)
        })
    })
})
app.get('/username', async (req, res) => {
    if (!req.cookies.token) {
        res.send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.send('Not logged in')
        return
    }
    const usern = tkn.username
    res.send(usern)
})
app.get('/checkuser/:user', (req, res) => {
    const sql = 'SELECT * FROM users WHERE Username = ?'
    db.execute(sql, [req.params.user], (e, r) => {
        if (e) {
            console.error(e)
            return
        }
        if (r.length != 0) {
            res.status(200).send('T')
        } else {
            res.status(404).send('F')
        }
    })
})
app.post('/send', async (req, res) => {
    if (!req.cookies.token) {
        res.status(401).send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.status(401).send('Not logged in')
        return
    }
    const usern = tkn.username
    const iicsql = `
    SELECT 1
FROM chat_users
WHERE cId = ? AND Username = ?
`
    db.execute(iicsql, [req.body.chat, usern], (err, result) => {
        if (err) {
            console.error(err)
            return
        }
        if (result.length == 0) {
            res.status(401).send('Unauthorized')
            return
        }
        console.log('AU')
        const sql = `INSERT INTO messages (cId, sender, content)
VALUES (?, ?, ?)

    `
        db.execute(
            sql,
            [req.body.chat, usern, req.body.content],
            (err, result) => {
                if (err) {
                    console.error(err)
                    return
                }

                res.status(200).send('yay')
            }
        )
    })
})
app.post('/signup', (req, res) => {
    const testsql = 'SELECT * FROM users WHERE Username = ?'
    db.execute(testsql, [req.body.username], async (err, results) => {
        if (err) {
            console.error(err)
        }
        if (results.length >= 1) {
            res.status(409).send(
                'Username already taken add another character, change it slightly, or make another one'
            )
            return
        }
        const hash = await bcrypt.hash(req.body.password, 12)
        const sql =
            'INSERT INTO Users (Username, Pass, Stat, Dispn) VALUES (?, ?, "User", ?)'
        db.execute(
            sql,
            [req.body.username, hash, req.body.username],
            async (err, results) => {
                if (err) {
                    console.error(err)
                }
                const token = await generateAccessToken(req.body.username)
                res.cookie('token', token, {
                    httpOnly: true,
                    maxAge: 1000 * 60 * 30,
                    path: '/',
                })
                res.status(201).send(
                    'Created! <button onclick="location.href= \'/\'">Go to main page</button>'
                )
            }
        )
    })
})
app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/signup.html')
})
app.post('/signin', (req, res) => {
    const testsql = 'SELECT * FROM users WHERE Username = ?'
    db.execute(testsql, [req.body.username], async (err, results) => {
        if (err) {
            console.error(err)
        }
        if (results.length == 0) {
            res.status(404).send('Invalid username')
            return
        }
        const correctpass = await bcrypt.compare(
            req.body.password,
            results[0].Pass
        )
        if (correctpass) {
            const token = await generateAccessToken(req.body.username)
            res.cookie('token', token, {
                httpOnly: true,
                maxAge: 1000 * 60 * 30,
                path: '/',
            })
            res.status(200).send(
                'Logged in! <button onclick="location.href= \'/\'">Go to main page</button>'
            )
        } else {
            res.status(400).send('Incorrect password')
        }
    })
})
app.post('/attatch', upload.single('image'), async (req, res) => {
    if (!req.cookies.token) {
        res.status(401).send('Not logged in')
        return
    }
    const tkn = await verifyToken(req.cookies.token)
    if (!tkn) {
        res.status(401).send('Not logged in')
        return
    }
    const usern = tkn.username
    const mid = req.body.msgId
    const file = req.files[0]
    const testsql = 'SELECT * FROM messages WHERE msgId = ?'
    db.execute(testsql, [usern], (err, results) => {
        if (results[0] && results[0].sender == usern) {
            const sql = `
                INSERT INTO uploadimgs (imgName,imgVal,mimeType) VALUES (?, ?,?)
            `
            db.execute(
                sql,
                [file.originalname, file.buffer, file.mimetype],
                (err, result) => {
                    const sql2 = `
                INSERT INTO attatchments ( uploadId,msgId) VALUES (?,?);
            `
                    db.execute(sql, [result.insertId, mid])
                    res.status(201).send('success')
                }
            )
        } else {
            res.status(401).send('message my be deleted')
        }
    })
})
app.get('/hand.ttf', (req, res) => {
    res.sendFile(__dirname + '/hand.ttf')
})
app.get('/signin', (req, res) => {
    res.sendFile(__dirname + '/signin.html')
})
app.listen(process.env.PORT, (err) => {
    if (err) {
        throw new Error(err)
    }
    console.log('Server starting at port ' + 8080)
})
