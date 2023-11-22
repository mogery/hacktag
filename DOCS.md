## Flow of task completion

 1. Fetch project page
 2. Obtain values from scripts
    * `projectid`: ID of task
    * `secret`: ID of "completion"
    * `user`: ID of user
 3. Scrape data from screens (for `i` of screens, starting at 1)
    * `pont_i`: max points of screen
    * `m_i`: type of screen
        * `3`: Multiple Choice
        * `13`: YouTube Video
    * `rublik_id_i`: ID of rublik (???)
 4. For every screen, follow instructions in [Screen-specific instructions](#screen-specific-instructions)
 5. After completion of each screen, GET `/system/functions/statistics.php` with the following query parameters
    * `group`: ID of group
    * `hslp`: ??? (seems to always be `0`)
    * `xcc`: ??? (seems to always be `undefined`)
    * `statAnswer`: answer (screen-specific)
    * `secret`: secret from project page
    * `project`: ID of task
    * `e`: ??? (seems to always be empty)
    * `user`: ID of user
    * `mid`: screen index (starting at 1)
    * `id`: ??? (seems to always be `0`)
    * `result`: ??? (seems to always be `0`)
    * `tfb`: ??? (seems to always be empty)
    * `tfbid`: ??? (seems to always be `0`)
    * `mpont`: max points of screen
    * `pont`: achieved points of screen

## Screen-specific instructions

### Finish Screen (`1`)
 * DO NOT DO ANYTHING. Complete no-op. Do not call statistics either.

### Single/Multiple Choice (`33`/`3`)
 * To find the correct answer, you need to decode the HSC of each answer option.
    1. First, find the number of answer options by getting the value of `#yoo_i` (`i` is the screen index, starting at 1).
    2. For each answer option, get the value of `input#vvv_i_j` (`j` is the answer index, start at 1), decode it (base64), split by `+` and parse as int.
    3. If `HSC[2] <= 1000`, the answer is correct.
    4. The **real index** of the answer can be found by subtracting 1 from `HSC[3]`
 * After completion, GET `/system/functions/reset_element.php` with the following query parameters
    * `group`: ID of group
    * `project`: ID of project
    * `ord`: screen index (starting at 1)
 * `statAnswer` is the **real index** of the last checked answer (or only checked answer ,for single choice)

### YouTube Video (`13`, `14`)
 * After completion, GET `/system/functions/rublik_test.php` with the following query parameters
    * `project`: ID of project
    * `element`: ID of rublik
    * `length`: Text Feedback Length (length of the value of `text_fb_i`, i is the screen index)
    * `time`: duration of screen completion, in milliseconds
 * `statAnswer` is `0`.