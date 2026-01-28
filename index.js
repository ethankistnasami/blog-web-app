import express from "express";
import pg from "pg";
import ejs from "ejs";
import bcrypt from "bcrypt";
import session from "express-session";
import pgSession from "connect-pg-simple";
import env from "dotenv";
import { setTimeout as delay } from "node:timers/promises";


const app = express();
const port = process.env.PORT || 3000;
const { Pool } = pg;
const PgSession = pgSession(session);

const saltRounds = 10;
env.config();                     

const db = new Pool({
    user: process.env.PG_USER,
    database: process.env.PG_DATABASE,
    host: process.env.PG_HOST,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT
    // connectionString: process.env.DATABASE_URL
    
});




app.use(express.urlencoded( { extended: true} ) );
app.use(express.static("public"));



app.use(
session({
    store: new PgSession ({
     pool: db,
     tableName: "session",
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true 
    } 

    }));

function checkAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/");
    } 
    next();
}

function createUser(userName, userEmail, userPassword) {
    bcrypt.hash(userPassword, saltRounds, async (err, hash) => {

        if (err) {
            console.log("Error hashing: ", err);

        } else {
            console.log("Hashed Password: ", hash);
            await db.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3)", [userName, userEmail, hash]);
        }        
    });

}



app.get("/", (req, res) => {
    if (req.session.user) {
        res.redirect("/home");
    } else {
        res.render("home.ejs", {submitBtn: "Log In", signupForm: false, btnAction: "/login"});
    }
    
});

app.get("/create-acc", (req, res) => {

    if (req.session.user) {
        res.redirect("/home");
    } else {
        res.render("home.ejs", {submitBtn: "Create Account", signupForm: true, btnAction: "/new-user"});
    }

});





app.get("/home", checkAuth, async (req, res) => {
    const result = await db.query("SELECT posts.id, user_id, name, title, content, created_at FROM posts JOIN users ON users.id = posts.user_id ORDER BY id ASC");

    res.render("home-page.ejs", {posts: result.rows, user: req.session.user});
    
});




//EDIT THIS
app.post("/new-post", async (req, res) => {
    // var currentDate = new Date();
    // req.session.user.post = req.body.postContent;
    // res.send(req.body.postContent);
    const result = await db.query("INSERT INTO posts (user_id, title, content) VALUES($1, $2, $3)", [req.session.user.id, req.body.titleContent.trim(), req.body.postContent.trim()]);
    // console.log(currentDate.toLocaleTimeString());
    // console.log(currentDate.toLocaleDateString());
    res.redirect("/home");
});

// app.get("/delete-post", (req, res) => {
//     console.log(req.body.deletePostBtn);
// });



app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid', { path: '/' });
        res.redirect("/");
    });

});


// let currentUser;

app.post("/new-user", async (req, res) => {
    //IF EMAIL ALREADY IN DATABASE THEN REDIRECT TO LOGIN WITH ERROR MESSAGE 

    try {
        const result = await db.query("SELECT * FROM users");


        //WHEN DB IS EMPTY 
        if (result.rows[0] == null) {
            // console.log("initiated");
            createUser(req.body.name, req.body.email, req.body.password);
            return res.render("home.ejs", {submitBtn: "Log In", signupForm: false, btnAction: "/login", errorMessage: "Account successfully created. Try logging in"});

        } 

        for (var i = 0; i < result.rows.length; i++) {
            if (result.rows[i].email == req.body.email) {
                 console.log("User already exists")
                 return res.render("home.ejs", {submitBtn: "Log In", signupForm: false, btnAction: "/login", errorMessage: "Account already exists. Try logging in"});

            }

        }
        
        createUser(req.body.name, req.body.email, req.body.password);
        return res.render("home.ejs", {submitBtn: "Log In", signupForm: false, btnAction: "/login", errorMessage: "Account successfully created. Try logging in"});
           

    } catch (err) {
        console.log(err);
    }


});





app.post("/login", async (req, res) => {
    var userExists = false;

    const result = await db.query("SELECT * FROM users");

    result.rows.forEach((currentRow) => {
        if (currentRow.email == req.body.email) {
            userExists = true;
            return;
        } else {
            return;

        }
    });

    if (!userExists) {
        res.render("home.ejs", {submitBtn: "Log In", signupForm: false, btnAction: "/login", errorMessage: "Incorrect credentials. Please try again"});

    } else {
        console.log("User exists");
        const currentUser = await db.query("SELECT * FROM users WHERE email=$1", [req.body.email]);
        const authenticateUser = await bcrypt.compare(req.body.password, currentUser.rows[0].password);

        if (authenticateUser) {
            req.session.user = {
                id: currentUser.rows[0].id,
                name: currentUser.rows[0].name,
                email: currentUser.rows[0].email
            }

            console.log(req.session.user.name);
            res.redirect("/home");

        } else {
            res.render("home.ejs", {submitBtn: "Log In", signupForm: false, btnAction: "/login", errorMessage: "Incorrect credentials. Please try again"});

        }

    }

});


//DELETE & EDIT ROUTES WITHOUT METHOD-OVERRIDE
app.post("/delete-post", checkAuth, async (req, res) => {
    // await delay(2000); 
    db.query("DELETE FROM posts WHERE id=$1", [req.body.deletePostBtn]);
    res.redirect("/home");

});



app.post("/edit-post", checkAuth, async (req, res) => {
    //const resultTwo = await db.query("SELECT post FROM post WHERE id=$1", [req.body.editPostBtn]);
    const result = await db.query("UPDATE posts SET content =$1 WHERE id=$2", [req.body.editContent, req.body.editPostIndex]);
    console.log(req.body.editContent, req.body.editPostIndex);
    res.redirect("/home");
    //res.render("home-page.ejs", {posts: result.rows, user: req.session.user, editContent: result.rows[0].post, editMode: true, editedPostIndex: req.body.editPostBtn});
});


app.listen(port, () => {
    console.log("Server is running on port", port);
    
});
