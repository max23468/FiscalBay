"""OAuth rendering responsibilities."""

from __future__ import annotations

import base64
import html
import logging
import textwrap

from .oauth_callback import public_bot_url

LOGGER = logging.getLogger("fiscalbay.oauth_server")

PUBLIC_ICON_SVG = textwrap.dedent(
    """
    <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="16" width="224" height="224" rx="56" fill="#16324F"/>
      <g transform="translate(22 46)">
        <g transform="rotate(-8 106 90)">
          <rect x="10" y="10" width="192" height="152" rx="28" fill="#16324F"/>
          <rect x="34" y="34" width="144" height="104" rx="20" fill="#FFFDF9"/>
          <rect x="56" y="52" width="90" height="14" rx="7" fill="#1F6FA8"/>
          <rect x="56" y="78" width="70" height="9" rx="4.5" fill="#38B6B3"/>
          <rect x="56" y="99" width="54" height="9" rx="4.5" fill="#E53238"/>
          <rect x="120" y="89" width="18" height="18" rx="6" fill="#F5AF02"/>
        </g>
      </g>
    </svg>
    """
).strip()

PUBLIC_ICON_PNG = base64.b64decode(
    """
    iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAAABmJLR0QA/wD/AP+gvaeTAAAW5UlEQVR4nO3dfXhcVZ0H8O+5d2Yy
    b22aZDIzmZkkk6aFUpa+JJCW8tIWqwhiU+QpsisCurq76MKKuKgoq4I8vqy7PKigKPs8rFUElJcGtItgWwSLpS1pQaDpSzLJzCQz
    k7cmzbxkXu7ZPyYpsaQk923uvcn5PE+f9nmac84v7benZ86991yAYRiGYRiGYRiGYRiGYRiGYRiGYRiGYQyNaF2AGP6Wq6tyWeFs
    SugyENJIQF2gxAkCJwC71vUZXAoUYyB0jIIMgNLjhJLDZgvXEX3t6UGti5stXQfa3bylkYBupAI2gmAjgBqta5qnekGxm4DshInf
    Fd/3ZKfWBZ2J7gLtWr3Zx3PYSkFuAsUqreth3osC7xCQJzgBj8QOPhPSup6pdBNod/OWD4HS2wFsAsBpXQ8zKwUAfwRHf5DY3/aC
    1sUA2geaeJpar6LA1wCs0bgWRg6CgxBwX6J99S+BbwralaER9+qrV4IIDwJYp1UNjPIIcIAIws2xg8/u02j80qpo3lpuEbJ3U4LP
    A+BLPT5TEgJAH86RsjuGD/xmpJQDlzTQ3lUfvUDgyGMAWVzKcRltUCBMBFyXOLh9T6nGLNUMSTzNm/+NEu7XAHGVaExGYwQoB8GN
    jppz+GTfdX8CdtMSjKmu4IYN1tTool8B9GNqj8Xo2pP2hSPXh3bvzqg5iKqBrj53q5NYck+B0A+qOQ5jDAT0pSwpa1VzXa1aoN1r
    NnuQw/MAWanWGIwBERyEiX44sbctrkb3qlzAqFxzxULkyA4WZuY9KFYhR14oP+8jFWp0r3iggxs2WE05y7MAVivdNzNnnGc1808H
    N2ywKt2x0oEmxQ+AuFThfpk5hoKsT50s3waFl72Kbtu5mzb/O4BbleyTmdOWO2uWjST7Ov6iVIeK/evwnr+lRRDoywAsSvXJzAs5
    CNig1MUXRQJd0by13EyzhwDUK9EfM++E8ubsyqG9O0bldqTIGtqC7D1gYWakC/I587eU6Ej2DO1pbj2PUrwOwKRAPcz8VaACOb//
    4DMH5XQid4YmlOJnYGFm5OMJRx+AzElWVqDdzVtaAayV0wfDTLHO09R6lZwOZAWaUtwppz3DnI5SfF1Oe8mBdjdv+RABvUDO4Azz
    HgQtntWtm6Q2lz5DFx9oZRjFUYIvSW0raQFetfIqP8/z3WCPUDHqEPJ5vn7ojaciYhtKmqE5E/9JsDAz6uFM5sJ1khpKaUSA66W0
    Y5hZo7hBSjPRSw5385ZGUHpMymAMIwYnkAaxJzOJnqEJFS4T24aZL5R9BrbA0Y1i24gONC0emsgw01D2iT4C8VkTv4amZL3oNgwj
    hYTJU1Sgfc0fdQHwiR2EYSShCAQu3FoppomoQOcJOVtcRQwjT248c5aYrxcVaFoACzRTUoLISVRUoDmQpeLKEUP1U6IYI6JExRma
    QJWzFIq0Pqqa0SNCqajMidvloFgg6usZRi4iLnNiZ2gWaKa0CKdeoAmIQ1w1DCOTyFWBqGcBKaUcYUtd3TObeNT63Aj6PWio9cLp
    sGGBww6OIwj39uNoKIo3O7owcjKpdakzopSKmnTZw60GZbGYUe9zo6HWe+pHMOBFQ8CLQI0LJv797+7N5fL4wysH8Ou2XXjxz+2g
    dG7sMrFA65jZbILPXYl6vwf1fg/ObqzF2Q0B1Ps9CNS4wHPSHzgym034yMY1+MjGNXjt0GHc8d2H8c6xHgWr1wYLtMacdltxhg1M
    zrKe4kxb60WNW9RVX8laVi7DC9u+h2/dvw0/f+z3JRlTLSzQJbBooRP1fjfqfR7UB9ynZtx6vwd1vmoQHXwwMZt4fPv2m+BxVeDe
    Bx417BKEBVohVRUL/2amnfx1MOBBRblxdjtvubEVJ0ZP4se/aNO6FElYoEWYbqY9e3EAyxrrsNBp17o8xXz1c3+PvYc6sO9Qh9al
    iMYCPQUhBD5P1cR2V83ETOtB0F/82W5T/MB5XTLxPO6/63O45NrbUBA0e8uxJPMy0N7qCpw1sVtQ75+YbX0eLA365k1oZ9JYX4Or
    PrAW218o2TszFTEnAz15YaEhULywEJycbf1e1PmqYTbPyW9bcf96w2YW6FKqqliIpnOXoLHeh2BgYpkQ8MLvrZrxwgIzsxXLFsPn
    qUJvfFDrUmbNcIGu87vx2Y9fiY1rV2JJ0KeLLa+5bF3Tcvx2x8talzFrhgl0jbsSd93yCbR+cB2bfUuoZeXZLNBKW9+yAg/ccwuq
    K8u1LmXeWRL0a12CKLoP9Gc/fgXuuf0mtrSYYjSdA0cAp9Ws+lgNgRrVx1CSrgN99eUX4e4vzr8wUwrERtIIDSTRPTiG7v4kQgNj
    CA0m0d2fRCqbBwAs9S7AzZedhY+dX6daLTXuCljLLMiMZ1UbQ0m6DfTypfX40Tc+D46bm2EuCBS9w2mEBsfQMzAR2IEkugeS6B5M
    YjxXmLGPo7GT+OKjB3AkNoqvXPV3qtRJCEF9wIOO42FV+leaLgNNCMH3v/wZw+8X5wsCwkMpdA8WgxrqH0NoYAzdg0mEB1PIFZS5
    CvfTnUexfpkXFy5xKdLf6RoCXhZoOa758MW4YKUxjgDJ5gX0DCYnlgPFWTY0MIaewSSiQynkhdLctfarPV0qBtqjSr9q0GWgP3m1
    5FdsqCKdLUzMsu8uC0L9Y+geSqJvOA1BB7daHo3LfgnrGQVrvar1rTTdBbrO78aaVctKPu5YJlcM6uDfBra7fwyxkUzJ6xHLalZv
    b76BBVq6jWtXqbarcSKVPfWhK9Q/dirAof4xDI6NqzJmqaxbUq1a3w1+FmjJljYos5GfHM/j6QM92N85hK6BYnhPpIyx9SRWud2C
    T1+6RLX+/TUumM0m5HJ51cZQiv4CrcCVqfbQEP75kb1IjOp/qSCXa0EZHrppDaoXlqk2Bs9xqPe5cay7V7UxlKK7QJtN8taC8ZEM
    PvXwq3N2NraYONRWObDY5URLowvXttSh3G5RfdyGgJcFWopUWt5a9qFdRwwfZquZR9DlQF2VA8FqJ4IuB+pdTtRXOeCrsEGL036M
    stOhu0CPJdOy2u85NqBQJepylJkQrHaivtKB+moHgi4HglVO1LkcqFlk07q89zDKTofuAh2O9ctqnxrXzweXcrvl3ZnW5UDQ5UT9
    xM+uBeqtedUQDLBASxIKx2W1b3Q70TNYujPbKp1lxZBOXR5UFZcIFQ7117alYpSrhboLdFe4T1b7a9cEsesdef8oTudeaJ0yuzpQ
    73KgvsqJYLUDC0pwC6ce1PndMJt45PIz3zSlJd0FOhSNyWp/xQofrrmgDk/um/05bYQA3nLblGWB89SsW1/tgN2iuz+mkjPxPPxe
    F0IRZScLpenub6ovMYzMeBbWMun/Xf/ndU1Y7ivHz3cfPXXZmucIfBU2BKuKgQ1WTy4Nij+XqXjpeK5oCHhZoMWilCIUiWNZY63k
    PjhC8I/rl+DTly5BbCSNgkDhKbfCzEs/rZMp7nTs+sshrct4X7r8G+6KyFt2TCIEqFlkQ6DSzsKsACPsdOhuhgaArrAygTaS4WwW
    0VQKFo7DkgULNLl4MpOgAXY6dBlova/TpOrPjCOSSiKSTiGSSiOSTCGSTiOSSiGVf3f/vNZhx/dWrUKD06lhte/VwGZoaeRu3WlF
    oBSJzPhEYJOIJIthnQzweGF2W17hZAp3HjqEX190kcoVixMMeMBxBEKJnsKRQp+BVmgNrYYCpYilM4ikUwgnU4imUginUoikUuhN
    p5FT6LTO0FgSPckU6hz6OabXYjGjxl2FaEy/txfoMtDR2ACy2RwsFm0uWuQEAX3pNMLpiWVBKlmcaVNpxNJp5Ev0yJVNhydENQS8
    8y/QFPJedCwIFN29CUXujT6TrCBMrGEn1rOpFCLJJCLpNOKZjObPCa5zuVBt1d/9Hg21Xryy/69al3FGqgRaic/noUhckUCP5LJ4
    fWj4tNCm0J8Zhx5XgmU8j8s8Htx+Tumfq5wNvW/d6XLJASizdfdoqBs/OXKkZEuE2eIJgddmRcBmR8DuQMBhQ8BuR63dDp/NBvPk
    69qoAJqOQEh1giaPgY4dBx2PgVj94P3XgitfUfLaG2r1vXWn20CHZH4wfOvECH7Uod07QkyEwGOzwme1wW+3w2e3w2+3wWe1ocHp
    QNn7rI9pbgS5d+5CIfI4aH764wlyx++Defm9MDd+Qa1vYVp637rTbaDlztB7BtT/4GLhOAQc9omZtjjLBhwO+G02eK1WaRdHChmM
    7/kwhJGD7/91VEDurTvBL2oGV3WJtG9AgoZaLwghun3tm34DLXOGtst8NnGSjTcVlwRTQ2t3wG+3wW21KvJ5Yap86Gczh/kUilzo
    YZSVMNA2axk8rkWI9Q+XbEwxdBvocG8/cvmC5IdmN3m9eKSzC2O53Ixf6zSbUWu3wW+zT8yytlPr2yoZd/1JUYj/n6ivp6Olv1mo
    obaGBVqsfKGASF+/5GfZPFYr7m9uwv0dR3B09CTKeA4Bux1+28QHMMe7v15k0c+TJZSKe0hYSIYAWgBI6fasGwJevPr62yUbTwzd
    BhooLjvkPJy5vLwcD7VcoGBF6iNWkVuVwjhoOgJir1enoGno+SYlXd9TOR/vuuMcjaLbCKlOFSo5Mz0faaDrQMvdujMiIiHQNFPa
    A2D0/MCsrgM9l2Zomp7deSOcvUF038RcIbqNHHo+o0PXa2ij3RctjI4iH46iEOlFPhJBIRxFPhJFPhyBMHQC4HnYLt+ERV++DcQ+
    /WEypHwFwFkAYXanPxFLJXjXeiW/jRktcNjhqlyIgSH1zqSWSteB7u5NoCAI4Dn9/EciDJ1APhxBPhKdCGykGOBwFMLoDH/BhQLS
    v38eyOdRce9/TPslxLQAprpPIR96aOZiCA/Lih8CvEPCdyJPQ20NC7RY2WwOvbFB1PrUO/t4OoXEAArhCPLRXuTDEzNttBhampR/
    iE1m50ugqRSIffp7nS3nfgc004dCrG3a3yemBeAqL4R56R3gqrR5CKAh4MW+Q9rdWnAmug40UNy6UzzQgoBCvL84y0YiyIejxaXC
    ZGgz6h7DS/MzHFfG21DW8jiEwVdQGHwZoHkQexCcfTGIYwmIVfsPZXrdutN/oMN9uLTlPFl90GwWqbbfYfwv+5HvCaMQ7QXNznwF
    US1lLeefcXaeiqu6GFzVxSWoSDy9fjDUfaBlfzAUBAzdegfGD7QrU5BMlhXnYtG37tS6DNn0eted7gMtd+su86c/axJmvroKfG0A
    poAfptoA+IAP5iWNMAXVe+trKbldpd0qnC39B1rmxZV8t0ovjOQ48J5qmPz+YnBr/TAFfOADfphq/SBWqzrj6oTdqp/7X6bSfaBD
    kTgopZLfjGVauljW+LyrCqbFQfB+P0z+GvABH0y+GpiCdSA2/R1MXio2HT7vCBgg0JnxLPoSw/B5KiW1t65tgfXiC5F55dVpf5+Y
    zeB93omZ1g9TXe2pmZb3eUFMuv8j0sTgsP72oAEDBBoo3tMhNdDgOFT+4F6kn38R2bcPg5jMxeDW+oshrvEAOrpwYxQdXRGtS5iW
    IQLdFenDuubl0jvgediuvBy2Ky9Xrqh57rBOX2ZviKmpO5LQugTmNG0vTr+E05ohAj2X7rqbC450RtD+1jGty5iWIQLdGTHm4Y1z
    1U9+9ZzWJZyRIQLNZmj9aH/rGB57bpfWZZyRIQKdTGWQGDyhdRnzXjKVwW3f/qmuj9M1RKCB+fk4lp7k8gV85iv/jXeOzf7tYlow
    TKA72bJDM8lUBv/01fuw89XZHoCjHUPsQwNAt8Eex5orjnRG8Nk779PtvvPpDBPot3X+X91c0x1N4MFtbXj02V3IanjvuFiGCfTe
    g4chCBQcp7+3Q80FBUHAO0d78Gr72/jTa29i556DyM/ynTB6YphAD4+cREdnGOcsmRv3E2shly8er9YViaErXPwRCsfQFYmhuzeB
    XG6GR8MMwDCBBoDHn9uNb37hBq3L0LVcvoDe+CC6o/F3f0QS6O6N4/DxCMazszsewagMFej/fepF3HrTFlQuWqh1KZrK5fLoTQyd
    CmxHZwQdnWF0R+OI9A2goNCbuIzIUIFOpTN4YFsb7rrleq1LUd1YKl1cEkTip5YIoYmf+xJDWpenW4YKNAA8+MtncemaFVjfUvr3
    iyjtxOgYuqPF5UB3JPE3y4Se3n7dnpKvZ6ICTQgRoPG7owSB4pZv/Bg7HvkO/J4qTWuZjcHh0eLMGomhs2dipo3G0RWOYXjkpNbl
    6V4xc7MnKtAUNKmHTbP4wAlc+ak78dgPv6aLXY/pZtojXREcPh7GyEn5Jy3NawSi/tWLm6EpTir+UhGJYv3D+NjNd+OH3/gcPnhx
    k6pjUUrRmxiaWMP2nba2jSOVVvekpXmNCuoFWuy/FrUNnRjF9bd9F1esvwB333Yj6vxuyX0VBAHRvgF0RafuzxZDGwrH5/x2l25R
    VWdoMkSJ/j6o7HhpH55/eT8uOf88fPyj67Gu6VzUuN/7UG0uX0C4N4GuSLw42/YUZ9uuaAw9vf1z4sLCXEMJEbWlIyrQAoRjRC9r
    jtMIAsVLr72Bl157AwBQvsCBxnofCoUCcvkCRk4mEe8fNuTl3HmN0KNivlzcDM2jAwbZsx85mcTrfxX1Z8HoEEepqDN7Rd0Pbeb4
    w+LKYRh5zGXWI2K+XvT6wd3UGgXgE9uOYUQjiCQObK8V00T8EysUu0W3YeY01bYJKEQ/jSs60IQTPwgzt6m1TUBRgkCDM+0U3YZh
    JOAFon6g4/ue7ATBW2LbMYxIb8QOPhMS20jSU99UwDYp7Rhm1gj5hZRm0gINug0Au0LBqEUo5POPSWkoKdAD7W29AP4opS3DzMIf
    Bg89F5XSUPpBMxz9geS2DPM+CCWSsyVrx8Xd1LoHwIVy+pivKNTb7jK4vYnXt6+V2ljWUWBEEL4np/18xsI8PQLu2/Layxzf3dT6
    CoB1MvsxIDbHKo7iz4n27ZdAxsVHuYc1UkLwLwDm4Y3ELMwKywPc5yHzSjovt4pkX0fC6V3mAsEauX0x89r9ifZnJO09T6XIcbo5
    S/YuACEl+mLmIYKuvDn7TSW6UiTQQ3t3jHKCcC0A9uAdI1YOAveJob07FHmTp+wlx6Sx2JFeh++cNIAPKdUnM/cRkC8l2p/5rXL9
    KYu4m1p/A+Aahftl5iAC+kT89bbroOAt1Uq/koJWj1v+AZS8oHC/zBxDKXbbFo7eCIWfD1Bl76lyzRULTbmyXQBV9wQYxqjezArk
    0hMHn1H81WaqvDRoaO+OUZiFK0Gg/7fMMKXWTvLcJjXCDKj4FqzE3rY4zVguYcsPZhKl2J0jlo3xN55W7eXtiu1yTCfV/3a2xtnw
    xLiVXwZguZpjMfpGQJ9YeDJ3Te9b21U9vbJU12+Jp3nzrZSS7wOwlGhMRh/ylOLr/e3bv48SnMVc0hsSXKs3n88RPA6QxaUcl9FM
    Dyh3XaL96VdLNaCqS47TpWIdvc7q+v8hvJkHsBYGepMtI0qeUPw4b8luHdj/7PFSDqzZLWPups0rQMmDILhIqxoY5RFgf4HSmwfa
    2/ZrNL62PKtbN1GCe1CcsRnjaqeEfqf/QNtvoeF7SzQP9KSJYH8JwCaUeCnESFYA8AKh+K94+/YXtS4G0FGgJ7lWb/bxHLZSyt3A
    rjTq1tsA+Q0n4BEph8GoSXeBnsq7akuwwNGNBPQygGwE4Ne6pnmJIAKKXRTYZaL8zr72p7q1LulMdB3o0wUu3FqZG8+cJYBfBoJG
    Qmk1ACcIcYJSh9b1GRohSVA6BmAMlCYo4To5FA5nckLHyJu/G9a6PIZhGIZhGIZhGIZhGIZhGIZhGIZhGIaZJ/4frO0ZHhoReicA
    AAAASUVORK5CYII=
    """
)


def public_icon_links() -> str:
    return (
        "<link rel='icon' href='/favicon.svg' type='image/svg+xml'>"
        "<link rel='icon' href='/favicon.png' type='image/png' sizes='180x180'>"
        "<link rel='apple-touch-icon' href='/apple-touch-icon.png' sizes='180x180'>"
        "<meta name='theme-color' content='#16324F'>"
    )


def render_public_icon_asset_for_path(path: str) -> tuple[bytes, str] | None:
    normalized_path = path.rstrip("/") or "/"
    if normalized_path == "/favicon.svg":
        return PUBLIC_ICON_SVG.encode("utf-8"), "image/svg+xml; charset=utf-8"
    if normalized_path in {"/favicon.png", "/apple-touch-icon.png", "/favicon.ico"}:
        return PUBLIC_ICON_PNG, "image/png"
    return None


def render_html_page(title: str, message: str, *, is_error: bool = False) -> bytes:
    accent = "#9a3412" if is_error else "#166534"
    badge = "Errore" if is_error else "OK"
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    body = (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"{public_icon_links()}"
        f"<title>{safe_title}</title>"
        "<style>"
        "body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f7f9;"
        "color:#111827;padding:40px;}"
        ".card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;"
        "border-radius:16px;padding:28px;box-shadow:0 18px 40px rgba(17,24,39,.08);}"
        f".badge{{display:inline-block;background:{accent};color:#fff;border-radius:999px;"
        "padding:6px 10px;font-size:12px;font-weight:700;"
        "letter-spacing:.04em;text-transform:uppercase;}}"
        "h1{margin:16px 0 10px;font-size:28px;}"
        "p{line-height:1.6;font-size:16px;color:#374151;}"
        "</style></head><body><div class='card'>"
        f"<span class='badge'>{badge}</span><h1>{safe_title}</h1><p>{safe_message}</p>"
        "</div></body></html>"
    )
    return body.encode("utf-8")


def render_action_html_page(
    title: str,
    message: str,
    *,
    is_error: bool = False,
    action_label: str = "",
    action_url: str = "",
    hint: str = "",
    auto_redirect_seconds: int | None = None,
) -> bytes:
    accent = "#9a3412" if is_error else "#166534"
    badge = "Errore" if is_error else "OK"
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    safe_hint = html.escape(hint)
    safe_action_label = html.escape(action_label)
    safe_action_url = html.escape(action_url, quote=True)
    meta_refresh = ""
    refresh_hint = ""
    if auto_redirect_seconds is not None and action_url:
        meta_refresh = (
            f"<meta http-equiv='refresh' content='{max(0, int(auto_redirect_seconds))};"
            f"url={safe_action_url}'>"
        )
        refresh_hint = (
            "<p class='muted'>Se non succede nulla automaticamente, usa il pulsante qui sotto.</p>"
        )
    action_block = ""
    if action_label and action_url:
        action_block = (
            f"<p><a class='button' href='{safe_action_url}'>{safe_action_label}</a></p>"
            f"{refresh_hint}"
        )
    hint_block = f"<p class='muted'>{safe_hint}</p>" if safe_hint else ""
    body = (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"{meta_refresh}"
        f"{public_icon_links()}"
        f"<title>{safe_title}</title>"
        "<style>"
        "body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f7f9;"
        "color:#111827;padding:40px;}"
        ".card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;"
        "border-radius:16px;padding:28px;box-shadow:0 18px 40px rgba(17,24,39,.08);}"
        f".badge{{display:inline-block;background:{accent};color:#fff;border-radius:999px;"
        "padding:6px 10px;font-size:12px;font-weight:700;"
        "letter-spacing:.04em;text-transform:uppercase;}}"
        "h1{margin:16px 0 10px;font-size:28px;}"
        "p{line-height:1.6;font-size:16px;color:#374151;}"
        ".muted{font-size:14px;color:#6b7280;}"
        ".button{display:inline-block;background:#111827;color:#fff;text-decoration:none;"
        "padding:12px 18px;border-radius:12px;font-weight:700;}"
        "</style></head><body><div class='card'>"
        f"<span class='badge'>{badge}</span><h1>{safe_title}</h1><p>{safe_message}</p>"
        f"{action_block}{hint_block}</div></body></html>"
    )
    return body.encode("utf-8")


def render_oauth_start_page(redirect_url: str) -> bytes:
    return render_action_html_page(
        "Continua con eBay",
        (
            "Stai per essere reindirizzato alla pagina di autorizzazione eBay. "
            "Completa il consenso nello stesso browser e poi torna pure su Telegram."
        ),
        action_label="Continua su eBay",
        action_url=redirect_url,
        hint=("Se chiudi questa pagina prima del consenso, il collegamento non verrà completato."),
        auto_redirect_seconds=0,
    )


def render_oauth_start_help_page() -> bytes:
    return render_action_html_page(
        "Collegamento da Telegram",
        (
            "Il collegamento eBay parte dal bot FiscalBay: apri Telegram, usa "
            "/account collega e torna qui con il link generato per la tua sessione."
        ),
        action_label="Apri Telegram",
        action_url=public_bot_url(),
        hint="Questo passaggio protegge lo stato OAuth e associa il consenso all'utente corretto.",
    )


def render_home_page() -> bytes:
    safe_public_bot_url = html.escape(public_bot_url(), quote=True)
    css = textwrap.dedent(
        """
        :root{
          --ink:#16324f;--text:#273444;--muted:#687385;--line:#dde6ef;
          --paper:#fffcf8;--blue:#1f6fa8;--teal:#38b6b3;
          --red:#e53238;--yellow:#f5af02;
        }
        *{box-sizing:border-box;}
        body{
          margin:0;background:var(--paper);color:var(--text);
          font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,
            'Segoe UI',sans-serif;
        }
        a{color:inherit;}
        .page{min-height:100vh;display:flex;flex-direction:column;}
        header{
          border-bottom:1px solid rgba(22,50,79,.10);
          background:rgba(255,252,248,.92);
          backdrop-filter:blur(14px);position:sticky;top:0;z-index:10;
        }
        .nav{
          max-width:1120px;margin:0 auto;padding:16px 24px;display:flex;
          align-items:center;justify-content:space-between;gap:20px;
        }
        .brand{
          display:flex;align-items:center;gap:12px;text-decoration:none;
          font-weight:800;color:var(--ink);
        }
        .mark{
          width:40px;height:40px;border-radius:12px;background:var(--ink);
          display:grid;place-items:center;
          box-shadow:0 10px 24px rgba(22,50,79,.18);
        }
        .mark svg{width:30px;height:30px;display:block;}
        .links{
          display:flex;align-items:center;gap:18px;font-size:14px;
          font-weight:700;color:#425166;
        }
        .links a{text-decoration:none;}
        .links a:hover{color:var(--blue);}
        .shell{max-width:1120px;margin:0 auto;padding:72px 24px 36px;width:100%;}
        .hero{
          display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,440px);
          gap:54px;align-items:center;
        }
        .eyebrow{
          margin:0 0 16px;color:var(--blue);font-size:13px;font-weight:800;
          letter-spacing:.08em;text-transform:uppercase;
        }
        h1{
          margin:0;color:var(--ink);font-size:clamp(44px,7vw,78px);
          line-height:.95;letter-spacing:0;
        }
        .lead{
          max-width:620px;margin:24px 0 0;color:#3f4d5f;
          font-size:20px;line-height:1.55;
        }
        .actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px;}
        .button{
          display:inline-flex;align-items:center;justify-content:center;
          min-height:46px;padding:12px 18px;border-radius:8px;
          text-decoration:none;font-weight:800;border:1px solid var(--ink);
        }
        .button.primary{
          background:var(--ink);color:white;
          box-shadow:0 14px 28px rgba(22,50,79,.18);
        }
        .button.secondary{background:white;color:var(--ink);}
        .note{margin-top:18px;color:var(--muted);font-size:14px;line-height:1.6;}
        .product{
          background:white;border:1px solid var(--line);border-radius:8px;
          box-shadow:0 24px 70px rgba(22,50,79,.12);overflow:hidden;
        }
        .product-head{
          display:flex;align-items:center;justify-content:space-between;
          padding:16px 18px;border-bottom:1px solid var(--line);background:#fbfdff;
        }
        .dots{display:flex;gap:6px;}
        .dots span{width:10px;height:10px;border-radius:50%;display:block;}
        .dots span:nth-child(1){background:var(--red);}
        .dots span:nth-child(2){background:var(--yellow);}
        .dots span:nth-child(3){background:var(--teal);}
        .product-title{font-size:13px;font-weight:800;color:var(--ink);}
        .phone{
          padding:20px;display:grid;gap:14px;
          background:linear-gradient(180deg,#fff 0%,#f7fbfc 100%);
        }
        .message{
          background:#eff8f8;border:1px solid #d5eeee;border-radius:8px;
          padding:15px 16px;line-height:1.5;color:#274151;
        }
        .message strong{color:var(--ink);}
        .receipt{
          border:1px solid var(--line);border-radius:8px;background:white;
          padding:16px;display:grid;gap:12px;
        }
        .row{
          display:flex;align-items:center;justify-content:space-between;
          gap:14px;font-size:14px;color:#566275;
        }
        .row b{
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          color:var(--ink);font-size:13px;
        }
        .pill{
          display:inline-flex;align-items:center;border-radius:999px;
          background:#fff4cc;color:#6f5200;font-size:12px;
          font-weight:800;padding:5px 9px;
        }
        .features{
          display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
          gap:16px;margin-top:56px;
        }
        .feature{background:white;border:1px solid var(--line);border-radius:8px;padding:22px;}
        .feature h2{margin:0 0 10px;color:var(--ink);font-size:18px;}
        .feature p{margin:0;color:#526071;line-height:1.6;font-size:15px;}
        footer{margin-top:auto;border-top:1px solid rgba(22,50,79,.10);}
        .foot{
          max-width:1120px;margin:0 auto;padding:22px 24px;display:flex;
          flex-wrap:wrap;align-items:center;justify-content:space-between;
          gap:12px;color:var(--muted);font-size:14px;
        }
        .foot nav{display:flex;gap:16px;font-weight:700;}
        .foot a{text-decoration:none;color:#425166;}
        @media(max-width:820px){
          .nav{align-items:flex-start;}
          .links{gap:12px;flex-wrap:wrap;justify-content:flex-end;}
          .shell{padding-top:44px;}
          .hero{grid-template-columns:1fr;gap:34px;}
          .features{grid-template-columns:1fr;}
          h1{font-size:48px;}
          .lead{font-size:18px;}
        }
        @media(max-width:520px){
          .nav{display:grid;}
          .links{justify-content:flex-start;}
          .shell{padding-left:18px;padding-right:18px;}
          .actions{display:grid;}
          .button{width:100%;}
          .row{display:grid;gap:4px;}
        }
        """
    ).strip()
    body = textwrap.dedent(
        f"""
        <!doctype html>
        <html lang='it'>
          <head>
            <meta charset='utf-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1'>
            {public_icon_links()}
            <title>FiscalBay | Assistente fiscale ordini eBay</title>
            <meta name='description' content='FiscalBay è un assistente
            Telegram first per venditori eBay che mostra gli identificativi fiscali
            disponibili nelle API ufficiali eBay.'>
            <style>{css}</style>
          </head>
          <body>
            <div class='page'>
              <header>
                <nav class='nav' aria-label='Navigazione principale'>
                  <a class='brand' href='/' aria-label='FiscalBay home'>
                    <span class='mark' aria-hidden='true'>
                      <svg viewBox='0 0 64 64' fill='none'
                        xmlns='http://www.w3.org/2000/svg'>
                        <rect x='9' y='10' width='46' height='40' rx='12'
                          fill='#fffdf9'/>
                        <rect x='18' y='19' width='28' height='5' rx='2.5'
                          fill='#1f6fa8'/>
                        <rect x='18' y='30' width='22' height='4' rx='2'
                          fill='#38b6b3'/>
                        <rect x='18' y='40' width='17' height='4' rx='2'
                          fill='#e53238'/>
                        <rect x='39' y='36' width='8' height='8' rx='3'
                          fill='#f5af02'/>
                      </svg>
                    </span>
                    <span>FiscalBay</span>
                  </a>
                  <div class='links'>
                    <a href='#prodotto'>Prodotto</a>
                    <a href='/privacy'>Privacy</a>
                    <a href='/about'>About</a>
                  </div>
                </nav>
              </header>
              <main class='shell'>
                <section class='hero' id='prodotto'>
                  <div>
                    <p class='eyebrow'>Telegram first per venditori eBay</p>
                    <h1>FiscalBay</h1>
                    <p class='lead'>
                      Assistente fiscale ordini per venditori eBay: legge dalle API
                      ufficiali gli identificativi disponibili sugli ordini e li
                      porta nella chat Telegram operativa.
                    </p>
                    <div class='actions'>
                      <a class='button primary' href='{safe_public_bot_url}'>
                        Apri Telegram
                      </a>
                      <a class='button secondary' href='#prodotto'>Come funziona</a>
                    </div>
                    <p class='note'>
                      Il dato fiscale viene mostrato solo quando eBay lo restituisce
                      davvero. FiscalBay non deduce e non ricostruisce informazioni
                      assenti.
                    </p>
                  </div>
                  <aside class='product' aria-label='Anteprima operativa FiscalBay'>
                    <div class='product-head'>
                      <div class='dots' aria-hidden='true'>
                        <span></span><span></span><span></span>
                      </div>
                      <div class='product-title'>notifica ordine Telegram</div>
                    </div>
                    <div class='phone'>
                      <div class='message'>
                        <strong>Nuovo ordine eBay</strong><br>
                        Identificativo fiscale trovato e pronto per la verifica operativa.
                      </div>
                      <div class='receipt'>
                        <div class='row'><span>Order ID</span><b>12-34567-89012</b></div>
                        <div class='row'><span>Tax identifier</span><b>CODICE_FISCALE</b></div>
                        <div class='row'><span>Valore</span><b>RSSMRA80A01H501U</b></div>
                        <div class='row'>
                          <span>Origine</span><span class='pill'>buyer.taxIdentifier</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </section>
                <section class='features' aria-label='Caratteristiche principali'>
                  <article class='feature'>
                    <h2>Avvio da Telegram</h2>
                    <p>
                      Accesso, richieste e passaggi operativi partono sempre dal bot
                      e dalla chat approvata.
                    </p>
                  </article>
                  <article class='feature'>
                    <h2>Operativo in chat</h2>
                    <p>
                      Comandi e notifiche restano su Telegram, con accesso approvato
                      e stato locale su VPS.
                    </p>
                  </article>
                  <article class='feature'>
                    <h2>Pagine pubbliche</h2>
                    <p>
                      Privacy e About restano disponibili per trasparenza, revisione
                      e configurazioni esterne.
                    </p>
                  </article>
                </section>
              </main>
              <footer>
                <div class='foot'>
                  <span>FiscalBay - Assistente fiscale ordini per venditori eBay</span>
                  <nav aria-label='Link legali'>
                    <a href='/privacy'>Privacy</a>
                    <a href='/about'>About</a>
                    <a href='/healthz'>Health</a>
                  </nav>
                </div>
              </footer>
            </div>
          </body>
        </html>
        """
    ).strip()
    return body.encode("utf-8")


def render_public_info_page(title: str, intro: str, sections: list[tuple[str, list[str]]]) -> bytes:
    safe_title = html.escape(title)
    safe_intro = html.escape(intro)
    section_blocks: list[str] = []
    for section_title, items in sections:
        safe_section_title = html.escape(section_title)
        item_block = "".join(f"<li>{html.escape(item)}</li>" for item in items)
        section_blocks.append(
            f"<section><h2>{safe_section_title}</h2><ul>{item_block}</ul></section>"
        )

    body = (
        "<!doctype html><html lang='it'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"{public_icon_links()}"
        f"<title>{safe_title}</title>"
        "<style>"
        "body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f7f9;"
        "color:#111827;margin:0;padding:40px;}"
        "main{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;"
        "border-radius:16px;padding:32px;box-shadow:0 18px 40px rgba(17,24,39,.08);}"
        ".eyebrow{color:#1f6fa8;font-size:13px;font-weight:800;text-transform:uppercase;"
        "letter-spacing:.08em;margin:0 0 10px;}"
        "h1{margin:0 0 12px;font-size:32px;line-height:1.15;color:#16324f;}"
        "h2{margin:28px 0 10px;font-size:18px;color:#1e2430;}"
        "p,li{line-height:1.65;font-size:16px;color:#374151;}"
        "ul{padding-left:22px;margin:0;}"
        ".footer{margin-top:30px;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;"
        "padding-top:18px;}"
        "a{color:#1f6fa8;}"
        "</style></head><body><main>"
        "<p class='eyebrow'><a href='/'>FiscalBay</a></p>"
        f"<h1>{safe_title}</h1><p>{safe_intro}</p>"
        f"{''.join(section_blocks)}"
        "<p class='footer'>Per richieste operative usa Telegram e contatta l'amministratore "
        "del servizio FiscalBay.</p>"
        "</main></body></html>"
    )
    return body.encode("utf-8")


def render_privacy_page() -> bytes:
    return render_public_info_page(
        "Informativa privacy",
        (
            "FiscalBay è un assistente operativo Telegram first per venditori eBay. "
            "Questa pagina riassume quali dati vengono trattati per mostrare in Telegram "
            "informazioni fiscali e operative restituite dalle API ufficiali."
        ),
        [
            (
                "Dati trattati",
                [
                    "identificativi Telegram necessari a gestire accesso, chat e notifiche",
                    (
                        "identificativo account eBay, ambiente API, scope autorizzati "
                        "e stato operativo"
                    ),
                    (
                        "refresh token eBay cifrato a riposo quando l'autorizzazione "
                        "tecnica viene completata"
                    ),
                    (
                        "dati ordine eBay restituiti dalle API ufficiali, inclusi "
                        "identificativi fiscali quando presenti nella risposta eBay"
                    ),
                    ("log tecnici, sessioni temporanee e audit minimo degli eventi di accesso"),
                ],
            ),
            (
                "Uso dei dati",
                [
                    "associare le richieste operative all'utente Telegram autorizzato",
                    "leggere ordini e dati fiscali disponibili tramite API eBay ufficiali",
                    "inviare notifiche operative nella chat Telegram autorizzata",
                    "diagnosticare errori, sicurezza dell'accesso e stato del servizio",
                ],
            ),
            (
                "Limiti e conservazione",
                [
                    "FiscalBay non deduce o ricostruisce dati fiscali assenti dalla risposta eBay",
                    (
                        "il servizio non conserva uno storico completo degli ordini "
                        "nel database locale"
                    ),
                    (
                        "i token OAuth sono dati sensibili e devono essere protetti "
                        "con cifratura a riposo"
                    ),
                    (
                        "l'accesso operativo è soggetto ad approvazione "
                        "dell'amministratore del servizio"
                    ),
                ],
            ),
        ],
    )


def render_about_page() -> bytes:
    return render_public_info_page(
        "About FiscalBay",
        (
            "FiscalBay aiuta i venditori eBay a controllare da Telegram identificativi fiscali, "
            "stato account e segnali operativi sugli ordini, usando le API ufficiali eBay."
        ),
        [
            (
                "Cosa fa",
                [
                    "porta nella chat Telegram segnali operativi sugli ordini eBay",
                    (
                        "legge ordini e informazioni fiscali effettivamente disponibili "
                        "nelle risposte eBay"
                    ),
                    (
                        "invia notifiche e riepiloghi operativi nella chat Telegram "
                        "dell'utente approvato"
                    ),
                    (
                        "mantiene il prodotto centrato su Telegram, con una parte web minima "
                        "per informative pubbliche e callback tecnico avviato dal bot"
                    ),
                ],
            ),
            (
                "Cosa non fa",
                [
                    "non è una dashboard eBay generalista",
                    "non sostituisce un gestionale ordini completo",
                    (
                        "non inventa partita IVA, codice fiscale o altri dati fiscali "
                        "se eBay non li restituisce"
                    ),
                    "non sposta l'operatività fuori da Telegram",
                ],
            ),
            (
                "Brand e accesso",
                [
                    "nome prodotto: FiscalBay",
                    "descrizione breve: assistente fiscale ordini per venditori eBay",
                    "accesso operativo tramite bot Telegram e approvazione dell'amministratore",
                    "servizio best effort senza SLA formale",
                ],
            ),
        ],
    )


def render_public_page_for_path(path: str) -> bytes | None:
    normalized_path = path.rstrip("/") or "/"
    if normalized_path == "/":
        return render_home_page()
    if normalized_path == "/privacy":
        return render_privacy_page()
    if normalized_path == "/about":
        return render_about_page()
    return None
