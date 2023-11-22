const { JSDOM } = require('jsdom');
const he = require('he');

{
    const originalEmit = process.emit;
    process.emit = function (name, data, ...args) {
        if (
            name === `warning` &&
            typeof data === `object` &&
            data.name === `ExperimentalWarning` 
            && data.message.includes(`Fetch API`)
        ) {
            return false;
        }
        return originalEmit.apply(process, arguments);
    };
}

if (process.argv.length != 4) {
    console.error("Usage: node index.js <session> <group>");
    process.exit(1);
}

const session = process.argv[2];
const getHeaders = () => ({
    "Cookie": `PHPSESSID=${session}; cookieconsent_status=dismiss`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Chromium";v="107", "Not=A?Brand";v="24"',
    "sec-ch-ua-mobile": '?0',
    "sec-ch-ua-platform": "macOS",
})

async function fetchProjects(groupId) {
    const groupURL = `https://hashtag.school/learning?menu=&id=${groupId}`;

    let groupReq = await fetch(groupURL, {
        headers: getHeaders(),
    });

    let groupRes = new JSDOM(await groupReq.text(), {
        url: groupURL,
    });

    let rows = [...groupRes.window.document.getElementById("form").children[8].children[0].children[0].children[0].children[0].children[8].children[0].children[0].children[0].children[0].children[4].children[0].children].slice(2);
    rows = rows.slice(0, rows.findIndex(x => x.children.length == 1));

    return rows.map(x => ({
        name: x.children[0].innerHTML,
        url: he.decode(x.children[1].children[0].outerHTML.match(/onclick="window.open\('(.+?)'/)[1]),
        date: x.children[2].innerHTML,
        points: x.children[3].innerHTML,
    }));
}

async function solveProject(groupId, project) {
    let maxPointsOverall = parseInt(project.points.split("/")[1]);
    let curPointsOverall = 0;

    process.stdin.write("Fetching project... ");

    let projectReq = await fetch(project.url, {
        headers: getHeaders(),
    });

    let projectDOM = new JSDOM(await projectReq.text(), {
        url: project.url,
    });

    console.log("done.");

    let injectedScript = projectDOM.window.document.querySelectorAll("#form > script")[3];
    if (!injectedScript) {
        throw "Couldn't find injected script.";
    }
    injectedScript = injectedScript.innerHTML;

    let projectId = parseInt((injectedScript.match(/var projectid=(\d+?);/) || ["", "NaN"])[1]);
    if (isNaN(projectId)) {
        throw "Couldn't find project ID.";
    }

    console.log("Project ID: " + projectId);

    let secret = (injectedScript.match(/var secret='(.+?)';/) || [])[1];
    if (!secret) {
        throw "Couldn't find secret.";
    }
    console.log("Secret:     " + secret);

    let statisticScript = projectDOM.window.document.querySelectorAll("#form > script")[6];
    if (!statisticScript) {
        throw "Couldn't find statistic script.";
    }
    statisticScript = statisticScript.innerHTML;

    let userId = parseInt((statisticScript.match(/&user=(\d+?)&/) || ["", "NaN"])[1]);
    if (isNaN(userId)) {
        throw "Couldn't find user ID.";
    }
    console.log("User ID:    " + userId);

    let testElem = projectDOM.window.document.getElementById("test");
    let screens = [...testElem.children[0].children[0].children].filter(x => x.nodeName == "TR").slice(0, -1);

    console.log("\n" + screens.length + " screens");

    for (let si = 1; si <= screens.length; si++) {
        let map = parseInt(projectDOM.window.document.getElementById("map_" + si).value);
        let mpont = parseInt(projectDOM.window.document.getElementById("pont_" + si).value);
        if (mpont == 0) {
            mpont = parseInt((projectDOM.window.document.getElementById("mpoint_" + map) || {innerHTML: "0"}).innerHTML);
        }
        let type = parseInt(projectDOM.window.document.getElementById("m_" + si).value);

        process.stdin.write(si + ": map " + map + " mpont " + mpont + " m " + type + " ");

        let statAnswer = 0;

        if (type == 3 || type == 33) {
            let optionCount = parseInt(projectDOM.window.document.getElementById("yoo_" + si).value);

            let correctIndices = [];

            for (let oi = 1; oi <= optionCount; oi++) {
                let hsc = Buffer.from(
                    projectDOM.window.document
                        .getElementById("vvv_" + si + "_" + oi)
                        .value,
                    'base64'
                )
                    .toString("utf8")
                    .split("+")
                    .map(x => parseInt(x));
                
                if (hsc[2] <= 1000) {
                    correctIndices.push(hsc[3] - 1);
                }
            }

            statAnswer = correctIndices.slice(-1)[0];
            console.log("corrects", correctIndices.join());
        } else if (type == 13 || type == 14) {
            let rublikId = parseInt(projectDOM.window.document.getElementById("rublik_id_" + si).value);
            console.log("rublik", rublikId);

            let rublikURL = "https://hashtag.school/system/functions/rublik_test.php?" + new URLSearchParams({
                project: projectId,
                element: rublikId,
                length: 0,
                time: 1000,
            }).toString();

            // console.log(rublikURL);

            let rublikReq = await fetch(rublikURL, {
                headers: getHeaders(),
            });

            if (rublikReq.status >= 400) {
                console.warn("rublik request failed with status " + rublikReq.status + ":", await rublikReq.text());
            }
        } else {
            console.warn("unknown task type", type, "-- spoofing max point with no answer");
        }

        if (curPointsOverall + mpont > maxPointsOverall) {
            throw "aborting: " + curPointsOverall + " + " + mpont + " > " + maxPointsOverall;
        }

        curPointsOverall += mpont;

        let statisticURL = "https://hashtag.school/system/functions/statistics.php?" + new URLSearchParams({
            group: groupId,
            hslp: 0,
            xcc: "undefined",
            statAnswer,
            secret,
            project: projectId,
            e: "",
            user: userId,
            mid: si,
            id: 0,
            result: 0,
            tfb: "",
            tfbid: 0,
            mpont,
            pont: mpont,
        }).toString();

        // console.log(statisticURL);

        let statisticReq = await fetch(statisticURL, {
            headers: getHeaders(),
        });

        if (statisticReq.status >= 400) {
            console.warn("statistic request failed with status " + statisticReq.status + ":", await statisticReq.text());
        }

        // await new Promise((resolve, reject) => {
        //     setTimeout(() => resolve(), 1500);
        // });

        if (type == 3 || type == 33) {
            let resetURL = "https://hashtag.school/system/functions/reset_element.php?" + new URLSearchParams({
                group: groupId,
                project: projectId,
                ord: si,
            }).toString();

            // console.log(resetURL);

            let resetReq = await fetch(resetURL, {
                headers: getHeaders(),
            });

            let resetRes = await resetReq.text();

            if (resetReq.status >= 400) {
                console.warn("reset request failed with status " + resetReq.status + ":", resetRes);
            }
        }
    }
}

(async () => {
    const groupId = process.argv[3];

    console.log("hacktag", require("./package.json").version, "by mogery\n");

    process.stdin.write("Fetching projects... ");
    const projects = await fetchProjects(groupId);
    console.log("done.");

    console.log("Available projects:");
    let maxNameWidth = Math.max(...projects.map(x => x.name.length));
    console.log(projects.map(({name, date, points}) => `${name.padEnd(maxNameWidth, " ")}\t${date}\t${points}`).join("\n"));

    for (let project of projects) {
        console.log("\n-- ", project.name + "\n");

        await solveProject(groupId, project);
    }
})();

// kemia: 12573