const zipInput = document.getElementById("zipInput");
const status = document.getElementById("status");

const stats = document.getElementById("stats");
const results = document.getElementById("results");

const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const notFollowingCount = document.getElementById("notFollowingCount");

const userList = document.getElementById("userList");
const search = document.getElementById("search");

const selectAll = document.getElementById("selectAll");
const clearAll = document.getElementById("clearAll");

let notFollowingUsers = [];


/*
========================================
CARGAR ZIP
========================================
*/

zipInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

        status.textContent = "⏳ Analizando tu archivo de Instagram...";

        const zip = await JSZip.loadAsync(file);

        const files = Object.keys(zip.files);

        console.log("Archivos encontrados:", files);

        const followersFiles = files.filter(file =>
            /followers(_\d+)?\.(json|html)$/i.test(
                file.split("/").pop()
            )
        );

        const followingFiles = files.filter(file =>
            /following\.(json|html)$/i.test(
                file.split("/").pop()
            )
        );

        /*
        Algunos ZIP de Instagram tienen carpetas.
        Buscamos también por nombre.
        */

        const followerMatches = files.filter(file =>
            file.toLowerCase().includes("followers")
        );

        const followingMatches = files.filter(file =>
            file.toLowerCase().includes("following")
        );

        console.log("Followers:", followerMatches);
        console.log("Following:", followingMatches);

        if (
            followerMatches.length === 0 ||
            followingMatches.length === 0
        ) {

            status.textContent =
                "❌ No encuentro los archivos de seguidores/seguidos.";

            return;
        }

        /*
        ========================================
        LEER FOLLOWERS
        ========================================
        */

        const followers = new Set();

        for (const filename of followerMatches) {

            const file = zip.files[filename];

            if (!file || file.dir) continue;

            const content = await file.async("string");

            const usernames = extractUsernames(content);

            usernames.forEach(username =>
                followers.add(username)
            );
        }


        /*
        ========================================
        LEER FOLLOWING
        ========================================
        */

        const following = new Set();

        for (const filename of followingMatches) {

            const file = zip.files[filename];

            if (!file || file.dir) continue;

            const content = await file.async("string");

            const usernames = extractUsernames(content);

            usernames.forEach(username =>
                following.add(username)
            );
        }


        /*
        ========================================
        COMPARACIÓN
        ========================================
        */

        notFollowingUsers = [...following]
            .filter(username => !followers.has(username))
            .sort();


        /*
        ========================================
        MOSTRAR RESULTADOS
        ========================================
        */

        followersCount.textContent = followers.size;

        followingCount.textContent = following.size;

        notFollowingCount.textContent =
            notFollowingUsers.length;

        stats.classList.remove("hidden");

        results.classList.remove("hidden");

        renderUsers();

        status.textContent =
            "✅ Análisis completado.";

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Error leyendo el archivo.";

    }

});


/*
========================================
EXTRAER USUARIOS
========================================
*/

function extractUsernames(content) {

    const usernames = new Set();

    /*
    JSON
    */

    try {

        const data = JSON.parse(content);

        extractFromJson(data, usernames);

    } catch {

        /*
        HTML
        */

        const parser = new DOMParser();

        const doc = parser.parseFromString(
            content,
            "text/html"
        );

        const links = doc.querySelectorAll("a");

        links.forEach(link => {

            const text =
                link.textContent.trim().toLowerCase();

            if (isValidUsername(text)) {

                usernames.add(text);

            }

        });

    }

    return usernames;
}


/*
========================================
RECORRER JSON
========================================
*/

function extractFromJson(data, usernames) {

    if (!data) return;


    if (Array.isArray(data)) {

        data.forEach(item =>
            extractFromJson(item, usernames)
        );

        return;
    }


    if (typeof data === "object") {

        /*
        Formato habitual de Instagram
        */

        if (Array.isArray(data.string_list_data)) {

            data.string_list_data.forEach(item => {

                if (
                    item &&
                    typeof item.value === "string"
                ) {

                    const username =
                        item.value
                            .trim()
                            .toLowerCase();

                    if (isValidUsername(username)) {

                        usernames.add(username);

                    }

                }

            });

        }


        /*
        Seguir buscando dentro del objeto
        */

        Object.values(data).forEach(value =>
            extractFromJson(value, usernames)
        );

    }

}


/*
========================================
VALIDAR USERNAME
========================================
*/

function isValidUsername(username) {

    if (!username) return false;

    if (username.length > 40) return false;

    return /^[a-zA-Z0-9._]+$/.test(username);

}


/*
========================================
MOSTRAR USUARIOS
========================================
*/

function renderUsers() {

    const query =
        search.value
            .trim()
            .toLowerCase();

    userList.innerHTML = "";

    const filtered =
        notFollowingUsers.filter(username =>
            username.includes(query)
        );


    filtered.forEach(username => {

        const row =
            document.createElement("div");

        row.className = "user";

        row.innerHTML = `
            <input
                type="checkbox"
                class="userCheckbox"
                value="${escapeHtml(username)}"
            >

            <span>@${escapeHtml(username)}</span>
        `;

        userList.appendChild(row);

    });

}


/*
========================================
BUSCADOR
========================================
*/

search.addEventListener(
    "input",
    renderUsers
);


/*
========================================
SELECCIONAR TODOS
========================================
*/

selectAll.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(".userCheckbox")
            .forEach(checkbox => {

                checkbox.checked = true;

            });

    }
);


/*
========================================
DESELECCIONAR
========================================
*/

clearAll.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(".userCheckbox")
            .forEach(checkbox => {

                checkbox.checked = false;

            });

    }
);


/*
========================================
SEGURIDAD HTML
========================================
*/

function escapeHtml(text) {

    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/*
========================================
SERVICE WORKER
========================================
*/

if ("serviceWorker" in navigator) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("service-worker.js")
                .catch(error =>
                    console.log(
                        "Service Worker:",
                        error
                    )
                );

        }
    );

}
