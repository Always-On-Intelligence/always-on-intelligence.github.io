<div align="center">

<a href="https://always-on-intelligence.github.io/"><img src="assets/readme/banner.gif" width="100%" alt="Always-On Personal Intelligence: A Roadmap Towards Continuing, Self-Evolving Loops"/></a>

<p>
  <a href="https://always-on-intelligence.github.io/"><img src="https://img.shields.io/badge/Project-Website-66816D?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Project website"/></a>
  <a href="https://always-on-intelligence.github.io/Always-On_Personal_Intelligence.pdf"><img src="https://img.shields.io/badge/Paper-PDF-355774?style=for-the-badge&logo=adobeacrobatreader&logoColor=white" alt="Paper (PDF)"/></a>
  <a href="https://github.com/Always-On-Intelligence/awesome-always-on-personal-intelligence"><img src="https://img.shields.io/badge/Reading-List-B88465?style=for-the-badge&logo=github&logoColor=white" alt="Reading list"/></a>
  <a href="https://github.com/Always-On-Intelligence/HALO"><img src="https://img.shields.io/badge/HALO-Code-6C5F7A?style=for-the-badge&logo=github&logoColor=white" alt="HALO code"/></a>
</p>

<p>The project page of the survey<br>
<b><i>Always-On Personal Intelligence: A Roadmap Towards Continuing, Self-Evolving Loops</i></b><br>
<a href="https://always-on-intelligence.github.io/"><b>always-on-intelligence.github.io</b></a></p>

</div>

## What's on the page

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="https://always-on-intelligence.github.io/#takeaways"><img src="assets/readme/takeaways.webp" alt="Main takeaways: twelve cards"/></a>
      <p align="center"><b>Main takeaways</b> · The survey at a glance</p>
    </td>
    <td width="50%" valign="top">
      <a href="https://always-on-intelligence.github.io/#framework"><img src="assets/readme/framework.webp" alt="Definitions and foundations: the framework figure"/></a>
      <p align="center"><b>Framework</b> · A continuing loop, and its self-evolving extension</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html"><img src="assets/readme/demo.webp" alt="The Demo page: an island of eight episodes"/></a>
      <p align="center"><b>Demo</b> · Play the loop</p>
    </td>
    <td width="50%" valign="top">
      <a href="https://always-on-intelligence.github.io/#applications"><img src="assets/readme/applications.webp" alt="Applications: wearable, digital, and physical systems"/></a>
      <p align="center"><b>Applications</b> · Where reported systems meet bottlenecks</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://always-on-intelligence.github.io/#levels"><img src="assets/readme/levels.webp" alt="Levels of loop closure, L0 to L5"/></a>
      <p align="center"><b>Levels</b> · How far the loop closes</p>
    </td>
    <td width="50%" valign="top">
      <a href="https://always-on-intelligence.github.io/#halo"><img src="assets/readme/halo.webp" alt="HALO read mode: coupling channels and the chain of evidence"/></a>
      <p align="center"><b>HALO</b> · Reading and running the loop</p>
    </td>
  </tr>
</table>

## Demo

Eight playable episodes, from smart glasses to a home robot. In each one you make one call for its assistant, then try a what-if. **[Open the demo](https://always-on-intelligence.github.io/play.html)**

<table>
  <tr>
    <td width="33%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html"><img src="assets/readme/demo-library.gif" alt="The episode library: eight cards, three wearable, three digital, two physical"/></a>
      <p align="center"><b>Episode library</b></p>
    </td>
    <td width="33%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html#case-robot-cup"><img src="assets/readme/demo-call.gif" alt="The call in episode 07: the viewer chooses to check the grasp before carrying the cup"/></a>
      <p align="center"><b>Make the call</b></p>
    </td>
    <td width="33%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html#case-robot-cup"><img src="assets/readme/demo-whatif.gif" alt="The ending of episode 07, then the what-if &quot;A child reaches in&quot;: the robot stops its arm"/></a>
      <p align="center"><b>Try a what-if</b></p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html#case-group-talk"><img src="assets/readme/demo-group-talk.gif" alt="Episode 03: the earbuds give the user a cue that only the user hears"/></a>
      <p align="center"><b>A private cue in a group talk</b></p>
    </td>
    <td width="33%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html#case-governed-revision"><img src="assets/readme/demo-governed.gif" alt="Episode 06: a review outside the agent accepts one rule change and rejects the other"/></a>
      <p align="center"><b>An agent that edits its own rules</b></p>
    </td>
    <td width="33%" valign="top">
      <a href="https://always-on-intelligence.github.io/play.html#case-care-visits"><img src="assets/readme/demo-care.gif" alt="Episode 08: the robot waits for a resident in the corridor, then visits the lounge"/></a>
      <p align="center"><b>A week of visits</b></p>
    </td>
  </tr>
</table>

## This repository

The site is static, with no build step: `index.html` is the paper's page and `play.html` is the Demo. The JSON files in `site/data/` are exported from the paper's LaTeX sources by the scripts in `tools/paper/`.

```sh
python3 -m http.server 8000 --bind 127.0.0.1   # then open http://127.0.0.1:8000/
node --test tests/*.test.mjs
```

[DEVELOPMENT.md](DEVELOPMENT.md) describes every file, the tests, how to publish, and where each part of the content comes from.

## Citation

```bibtex
@misc{alwayson2026roadmap,
  title  = {Always-On Personal Intelligence: A Roadmap Towards
            Continuing, Self-Evolving Loops},
  author = {Liu, Shuai and Guo, Hongming and Jin, Weiyang and Hu, Kairui and
            Tian, Shulin and Dong, Yuhao and Wu, Jinming and Zhang, Kaichen and
            Tang, Yujin and Han, Xinyang and Chai, Wenhao and Fu, Yuqian and
            Zhang, Ce and Zhang, Yuanhan and Kong, Lingdong and Siyao, Li and
            Yang, Jingkang and Bertasius, Gedas and Li, Manling and Wu, Jiajun and
            Wang, Mengdi and Song, Dawn and Liu, Ziwei},
  year   = {2026},
  note   = {Working draft},
  url    = {https://always-on-intelligence.github.io/}
}
```
